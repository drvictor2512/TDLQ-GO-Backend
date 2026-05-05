const Order = require("../models/order.model");
const { publishEvent } = require("../config/rabbitmq");

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://user:3001";
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || "http://product:3002";

const PERIOD_MS = {
  "7days":   7   * 24 * 60 * 60 * 1000,
  "30days":  30  * 24 * 60 * 60 * 1000,
  "3months": 90  * 24 * 60 * 60 * 1000,
  "6months": 180 * 24 * 60 * 60 * 1000,
  "year":    365 * 24 * 60 * 60 * 1000,
};

exports.createOrder = async (req, res) => {
  try {
    const {
      customer_id,
      items,
      shipping_address,
      receiver_name,
      phone_number,
      payment_method,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Order items cannot be empty" });
    }

    // ── BƯỚC 1: Validate customer (sync HTTP) ──────────────────────────────
    const userRes = await fetch(`${USER_SERVICE_URL}/api/users/${customer_id}`);
    if (!userRes.ok) {
      return res.status(400).json({ message: "Invalid customer_id or user not found" });
    }

    // ── BƯỚC 2: Validate sản phẩm + CHECK TỒN KHO (sync HTTP) ─────────────
    let total_amount = 0;
    const validatedItems = [];
    let detected_seller_id = req.body.seller_id || null;

    for (const item of items) {
      const productRes = await fetch(`${PRODUCT_SERVICE_URL}/products/${item.product_id}`);
      if (!productRes.ok) {
        return res.status(400).json({ message: `Product ${item.product_id} not found` });
      }

      const productData = await productRes.json();
      const product = productData.data;

      if (!product) {
        return res.status(400).json({ message: `Product ${item.product_id} data invalid` });
      }

      // ── Kiểm tra tồn kho đủ để đặt hàng ──────────────────────────────────
      if (product.stock_quantity < item.quantity) {
        return res.status(400).json({
          message: `Sản phẩm "${product.name}" không đủ tồn kho. Hiện còn ${product.stock_quantity} sản phẩm, bạn yêu cầu ${item.quantity}.`,
        });
      }

      if (!detected_seller_id && product.seller_id) {
        detected_seller_id = product.seller_id;
      }

      console.log(`[Order] product_id=${product._id}, seller_id=${product.seller_id}, detected=${detected_seller_id}`);

      const unitPrice = product.discount_price ?? product.price;

      validatedItems.push({
        product_id: product._id,
        product_name: product.name,
        quantity: item.quantity,
        price: unitPrice,
      });

      total_amount += item.quantity * unitPrice;
    }

    // ── BƯỚC 3: Lưu đơn hàng vào MongoDB ───────────────────────────────────
    if (!detected_seller_id) {
      return res.status(400).json({ message: "Không xác định được seller của sản phẩm" });
    }

    const newOrder = await Order.create({
      customer_id,
      seller_id: detected_seller_id,
      items: validatedItems,
      total_amount,
      shipping_address,
      receiver_name,
      phone_number,
      payment_method,
    });

    // ── BƯỚC 4: Publish event "order.created" vào RabbitMQ (async) ─────────
    // Product Service sẽ tự lắng nghe và trừ tồn kho ở background
    publishEvent("order.created", {
      order_id: newOrder._id.toString(),
      items: validatedItems.map((i) => ({
        product_id: i.product_id.toString(),
        quantity: i.quantity,
      })),
      timestamp: new Date().toISOString(),
    });

    return res.status(201).json({
      message: "Order created successfully",
      order: newOrder,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find();
    return res.status(200).json(orders);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getOrdersBySeller = async (req, res) => {
  try {
    const seller_id = req.params.seller_id;
    const orders = await Order.find({ seller_id }).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const order_id = req.params.id;
    const { status } = req.body;

    const validStatuses = [
      "pending",
      "confirmed",
      "preparing",
      "delivering",
      "completed",
      "cancelled",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const order = await Order.findByIdAndUpdate(
      order_id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // ── Publish event tương ứng khi đơn hàng hoàn thành hoặc bị hủy ────────
    if (status === "completed") {
      // Product Service sẽ tăng sold_count
      publishEvent("order.completed", {
        order_id: order._id.toString(),
        items: order.items.map((i) => ({
          product_id: i.product_id.toString(),
          quantity: i.quantity,
        })),
        timestamp: new Date().toISOString(),
      });
    } else if (status === "cancelled") {
      // Product Service sẽ hoàn lại tồn kho
      publishEvent("order.cancelled", {
        order_id: order._id.toString(),
        items: order.items.map((i) => ({
          product_id: i.product_id.toString(),
          quantity: i.quantity,
        })),
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSellerStats = async (req, res) => {
  try {
    const { seller_id } = req.params;
    const period = req.query.period || "30days";

    const ms = PERIOD_MS[period];
    if (!ms) {
      return res.status(400).json({
        message: "period không hợp lệ. Dùng: 7days, 30days, 3months, 6months, year",
      });
    }

    const startDate = new Date(Date.now() - ms);

    const aggregateResult = await Order.aggregate([
      {
        $match: {
          seller_id: seller_id,
          createdAt: { $gte: startDate },
        },
      },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                total_orders: { $sum: 1 },
                total_revenue: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "completed"] }, "$total_amount", 0],
                  },
                },
                completed_orders: {
                  $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
                },
                cancelled_orders: {
                  $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
                },
                pending_orders: {
                  $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
                },
              },
            },
            {
              $project: {
                _id: 0,
                total_revenue: 1,
                total_orders: 1,
                completed_orders: 1,
                cancelled_orders: 1,
                pending_orders: 1,
              },
            },
          ],

          revenue_by_date: [
            { $match: { status: "completed" } },
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                },
                revenue: { $sum: "$total_amount" },
                orders: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                date: "$_id",
                revenue: 1,
                orders: 1,
              },
            },
          ],

          top_products: [
            { $match: { status: "completed" } },
            { $unwind: "$items" },
            {
              $group: {
                _id: "$items.product_id",
                product_name: { $first: "$items.product_name" },
                total_quantity: { $sum: "$items.quantity" },
                total_revenue: {
                  $sum: { $multiply: ["$items.quantity", "$items.price"] },
                },
              },
            },
            { $sort: { total_revenue: -1 } },
            { $limit: 10 },
            {
              $project: {
                _id: 0,
                product_id: { $toString: "$_id" },
                product_name: 1,
                total_quantity: 1,
                total_revenue: 1,
              },
            },
          ],

          status_distribution: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                status: "$_id",
                count: 1,
              },
            },
          ],
        },
      },
    ]);

    const result = aggregateResult[0] || {
      summary: [],
      revenue_by_date: [],
      top_products: [],
      status_distribution: [],
    };

    const summary = result.summary[0] || {
      total_revenue: 0,
      total_orders: 0,
      completed_orders: 0,
      cancelled_orders: 0,
      pending_orders: 0,
    };

    return res.status(200).json({
      summary,
      revenue_by_date: result.revenue_by_date,
      top_products: result.top_products,
      status_distribution: result.status_distribution,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
