const { VNPay, ignoreLogger, ProductCode, VnpLocale } = require("vnpay");
const Order = require("../models/order.model");
const Notification = require("../models/notification.model");
const { publishEvent } = require("../config/rabbitmq");

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://user:3001";
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || "http://product:3002";
const GATEWAY_URL = process.env.GATEWAY_URL || "http://api-gateway:3000";

async function saveAndNotify(targetUserId, type, title, message, orderId) {
  try {
    await Notification.create({ userId: targetUserId, type, title, message, orderId });
  } catch (err) {
    console.error("[Notification] Save failed:", err.message);
  }
  try {
    await fetch(`${GATEWAY_URL}/internal/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId, type, title, message, orderId }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    console.error("[Notify] Gateway emit failed:", err.message);
  }
}

const VNPAY_RETURN_URL = process.env.VNPAY_RETURN_URL || "http://localhost:5173/thanh-toan/ket-qua";

const vnpay = new VNPay({
  tmnCode: process.env.VNPAY_TMN_CODE || "",
  secureSecret: process.env.VNPAY_HASH_SECRET || "",
  vnpayHost: "https://sandbox.vnpayment.vn",
  testMode: true,
  hashAlgorithm: "SHA512",
  enableLog: false,
  loggerFn: ignoreLogger,
});

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
    const userRes = await fetch(`${USER_SERVICE_URL}/api/users/${customer_id}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!userRes.ok) {
      return res.status(400).json({ message: "Invalid customer_id or user not found" });
    }

    // ── BƯỚC 2: Validate sản phẩm + CHECK TỒN KHO (sync HTTP) ─────────────
    let total_amount = 0;
    const validatedItems = [];
    let detected_seller_id = req.body.seller_id || null;

    for (const item of items) {
      const productRes = await fetch(`${PRODUCT_SERVICE_URL}/products/${item.product_id}`, {
        signal: AbortSignal.timeout(5000),
      });
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

      const unitPrice = product.discount_price || product.price;

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
    publishEvent("order.created", {
      order_id: newOrder._id.toString(),
      items: validatedItems.map((i) => ({
        product_id: i.product_id.toString(),
        quantity: i.quantity,
      })),
      timestamp: new Date().toISOString(),
    });

    // ── BƯỚC 5: Gửi thông báo real-time ─────────────────────────────────────
    const orderShort = newOrder._id.toString().slice(-6).toUpperCase();
    saveAndNotify(
      customer_id,
      "order_created",
      "Đặt hàng thành công",
      `Đơn hàng #${orderShort} đã được tạo, đang chờ xác nhận.`,
      newOrder._id.toString()
    );
    saveAndNotify(
      detected_seller_id,
      "new_order",
      "Đơn hàng mới",
      `Bạn có đơn hàng mới #${orderShort} cần xác nhận.`,
      newOrder._id.toString()
    );

    return res.status(201).json({
      message: "Order created successfully",
      order: newOrder,
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return res.status(503).json({ message: "Dịch vụ tạm thời không phản hồi, vui lòng thử lại" });
    }
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

exports.getOrdersByCustomer = async (req, res) => {
  try {
    const { customer_id } = req.params;
    const orders = await Order.find({ customer_id }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: orders });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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
      "awaiting_payment",
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

    // ── Thông báo khách hàng khi trạng thái thay đổi ────────────────────────
    const statusMessages = {
      confirmed:  "Đơn hàng của bạn đã được xác nhận.",
      preparing:  "Người bán đang chuẩn bị hàng.",
      delivering: "Đơn hàng đang trên đường giao đến bạn.",
      completed:  "Đơn hàng đã giao thành công. Cảm ơn bạn!",
      cancelled:  "Đơn hàng của bạn đã bị hủy.",
    };
    const statusTitles = {
      confirmed:  "Đơn hàng đã xác nhận",
      preparing:  "Đang chuẩn bị hàng",
      delivering: "Đang giao hàng",
      completed:  "Giao hàng thành công",
      cancelled:  "Đơn hàng bị hủy",
    };
    if (statusMessages[status]) {
      const orderShort = order._id.toString().slice(-6).toUpperCase();
      saveAndNotify(
        order.customer_id,
        status,
        statusTitles[status],
        `${statusMessages[status]} (Đơn #${orderShort})`,
        order._id.toString()
      );
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

// GET /orders/admin/stats?period=30days
// System-wide stats for admin dashboard
exports.getAdminStats = async (req, res) => {
  try {
    const period = req.query.period || "30days";
    const ms = PERIOD_MS[period];
    if (!ms) {
      return res.status(400).json({ message: "period không hợp lệ" });
    }
    const startDate = new Date(Date.now() - ms);

    const [aggregateResult, totalAllTime] = await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  total_orders: { $sum: 1 },
                  total_revenue: {
                    $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$total_amount", 0] },
                  },
                  completed_orders: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                  cancelled_orders: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
                  pending_orders: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
                },
              },
              { $project: { _id: 0 } },
            ],
            revenue_by_date: [
              { $match: { status: "completed" } },
              {
                $group: {
                  _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                  revenue: { $sum: "$total_amount" },
                  orders: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
              { $project: { _id: 0, date: "$_id", revenue: 1, orders: 1 } },
            ],
            top_products: [
              { $match: { status: "completed" } },
              { $unwind: "$items" },
              {
                $group: {
                  _id: "$items.product_id",
                  product_name: { $first: "$items.product_name" },
                  total_quantity: { $sum: "$items.quantity" },
                  total_revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
                },
              },
              { $sort: { total_revenue: -1 } },
              { $limit: 10 },
              { $project: { _id: 0, product_id: { $toString: "$_id" }, product_name: 1, total_quantity: 1, total_revenue: 1 } },
            ],
            status_distribution: [
              { $group: { _id: "$status", count: { $sum: 1 } } },
              { $project: { _id: 0, status: "$_id", count: 1 } },
            ],
          },
        },
      ]),
      Order.countDocuments(),
    ]);

    const result = aggregateResult[0] || {};
    const summary = result.summary?.[0] || {
      total_revenue: 0, total_orders: 0, completed_orders: 0, cancelled_orders: 0, pending_orders: 0,
    };

    return res.status(200).json({
      summary: { ...summary, total_all_time: totalAllTime },
      revenue_by_date: result.revenue_by_date || [],
      top_products: result.top_products || [],
      status_distribution: result.status_distribution || [],
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// POST /orders/vnpay/create-payment
exports.createVNPayPayment = async (req, res) => {
  try {
    const {
      customer_id,
      items,
      shipping_address,
      receiver_name,
      phone_number,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Order items cannot be empty" });
    }

    const userRes = await fetch(`${USER_SERVICE_URL}/api/users/${customer_id}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!userRes.ok) {
      return res.status(400).json({ message: "Invalid customer_id or user not found" });
    }

    let total_amount = 0;
    const validatedItems = [];
    let detected_seller_id = req.body.seller_id || null;

    for (const item of items) {
      const productRes = await fetch(`${PRODUCT_SERVICE_URL}/products/${item.product_id}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!productRes.ok) {
        return res.status(400).json({ message: `Product ${item.product_id} not found` });
      }

      const productData = await productRes.json();
      const product = productData.data;

      if (!product) {
        return res.status(400).json({ message: `Product ${item.product_id} data invalid` });
      }

      if (product.stock_quantity < item.quantity) {
        return res.status(400).json({
          message: `Sản phẩm "${product.name}" không đủ tồn kho. Hiện còn ${product.stock_quantity} sản phẩm.`,
        });
      }

      if (!detected_seller_id && product.seller_id) {
        detected_seller_id = product.seller_id;
      }

      const unitPrice = product.discount_price || product.price;
      validatedItems.push({
        product_id: product._id,
        product_name: product.name,
        quantity: item.quantity,
        price: unitPrice,
      });
      total_amount += item.quantity * unitPrice;
    }

    if (!detected_seller_id) {
      return res.status(400).json({ message: "Không xác định được seller của sản phẩm" });
    }

    if (total_amount <= 0) {
      return res.status(400).json({ message: "Tổng tiền đơn hàng không hợp lệ" });
    }

    const newOrder = await Order.create({
      customer_id,
      seller_id: detected_seller_id,
      items: validatedItems,
      total_amount,
      shipping_address,
      receiver_name,
      phone_number,
      payment_method: "VNPay",
      status: "awaiting_payment",
      payment_status: "pending",
    });

    const ipAddr =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "127.0.0.1";

    let paymentUrl;
    try {
      paymentUrl = vnpay.buildPaymentUrl({
        vnp_Amount: total_amount,
        vnp_IpAddr: ipAddr,
        vnp_TxnRef: newOrder._id.toString(),
        vnp_OrderInfo: `Thanh toan don hang ${newOrder._id}`,
        vnp_OrderType: ProductCode.Other,
        vnp_ReturnUrl: VNPAY_RETURN_URL,
        vnp_Locale: VnpLocale.VN,
      });
    } catch (vnpayErr) {
      await Order.findByIdAndDelete(newOrder._id);
      return res.status(500).json({ message: "Không thể tạo link thanh toán VNPay" });
    }

    return res.status(201).json({
      success: true,
      orderId: newOrder._id.toString(),
      paymentUrl,
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return res.status(503).json({ message: "Dịch vụ tạm thời không phản hồi, vui lòng thử lại" });
    }
    return res.status(500).json({ message: error.message });
  }
};

// GET /orders/vnpay/verify?vnp_TxnRef=...&vnp_ResponseCode=...&...
exports.verifyVNPayPayment = async (req, res) => {
  try {
    const query = req.query;

    const verify = vnpay.verifyReturnUrl(query);
    if (!verify.isVerified) {
      return res.status(400).json({ success: false, message: "Chữ ký không hợp lệ" });
    }

    const orderId = query.vnp_TxnRef;
    const responseCode = query.vnp_ResponseCode;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    // Idempotency guard: already processed
    if (order.payment_status !== "pending") {
      return res.status(200).json({
        success: order.payment_status === "paid",
        message: "Đơn hàng đã được xử lý trước đó",
        order,
      });
    }

    if (responseCode === "00") {
      order.payment_status = "paid";
      order.status = "pending";
      order.vnpay_txn_ref = query.vnp_TransactionNo || null;
      await order.save();

      publishEvent("order.created", {
        order_id: order._id.toString(),
        items: order.items.map((i) => ({
          product_id: i.product_id.toString(),
          quantity: i.quantity,
        })),
        timestamp: new Date().toISOString(),
      });

      return res.status(200).json({
        success: true,
        message: "Thanh toán thành công",
        order,
      });
    } else {
      order.payment_status = "failed";
      order.status = "cancelled";
      await order.save();

      return res.status(200).json({
        success: false,
        message: "Thanh toán thất bại hoặc bị huỷ",
        order,
      });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
