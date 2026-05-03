const Order = require("../models/order.model");

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://user:3001";
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || "http://product:3002";

const PERIOD_MS = {
  "7days":   7   * 24 * 60 * 60 * 1000,
  "30days":  30  * 24 * 60 * 60 * 1000,
  "3months": 90  * 24 * 60 * 60 * 1000,
  "6months": 180 * 24 * 60 * 60 * 1000,
  "year":    365 * 24 * 60 * 60 * 1000,
};

// Gọi product-service để điều chỉnh tồn kho / số đã bán.
// Fire-and-forget: lỗi chỉ log warning, không ảnh hưởng đến response chính.
async function adjustStock(items, deltas) {
  const calls = items.map(async (item) => {
    const body = {};
    if (deltas.stock_delta !== undefined) body.stock_delta = deltas.stock_delta(item.quantity);
    if (deltas.sold_delta !== undefined) body.sold_delta = deltas.sold_delta(item.quantity);

    try {
      const res = await fetch(
        `${PRODUCT_SERVICE_URL}/products/${item.product_id}/stock`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.warn(
          `[OrderService] adjustStock product ${item.product_id}:`,
          errBody.message
        );
      }
    } catch (err) {
      console.warn(
        `[OrderService] adjustStock network error product ${item.product_id}:`,
        err.message
      );
    }
  });

  await Promise.all(calls);
}

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

    // 1. Validate customer via User Service
    const userRes = await fetch(`${USER_SERVICE_URL}/api/users/${customer_id}`);
    if (!userRes.ok) {
      return res.status(400).json({ message: "Invalid customer_id or user not found" });
    }

    // 2. Fetch products và tính total_amount từ nguồn
    let total_amount = 0;
    const validatedItems = [];
    let detected_seller_id = req.body.seller_id || null;

    for (const item of items) {
      const productRes = await fetch(
        `${PRODUCT_SERVICE_URL}/products/${item.product_id}`
      );
      if (!productRes.ok) {
        return res.status(400).json({ message: `Product ${item.product_id} not found` });
      }

      const productData = await productRes.json();
      const product = productData.data;

      if (!detected_seller_id) {
        detected_seller_id = product.seller_id;
      }

      validatedItems.push({
        product_id: product._id,
        product_name: product.name,
        quantity: item.quantity,
        price: product.price,
      });

      total_amount += item.quantity * product.price;
    }

    const newOrder = await Order.create({
      customer_id,
      seller_id: detected_seller_id || "system",
      items: validatedItems,
      total_amount,
      shipping_address,
      receiver_name,
      phone_number,
      payment_method,
    });

    // Giảm tồn kho sau khi tạo đơn thành công
    adjustStock(validatedItems, { stock_delta: (qty) => -qty });

    res.status(201).json({
      message: "Order created successfully",
      order: newOrder,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find();
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getOrdersBySeller = async (req, res) => {
  try {
    const seller_id = req.params.seller_id;
    const orders = await Order.find({ seller_id }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    // Cập nhật tồn kho theo trạng thái cuối
    if (status === "completed") {
      // Tăng số đã bán (stock đã giảm lúc tạo đơn)
      adjustStock(order.items, { sold_delta: (qty) => qty });
    } else if (status === "cancelled") {
      // Hoàn lại tồn kho
      adjustStock(order.items, { stock_delta: (qty) => qty });
    }

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    const [result] = await Order.aggregate([
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
