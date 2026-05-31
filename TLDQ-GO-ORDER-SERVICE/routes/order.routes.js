const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order.controller");
const notificationController = require("../controllers/notification.controller");

router.post("/", orderController.createOrder);
router.get("/", orderController.getOrders);

// VNPay routes — must be before parameterised routes
router.post("/vnpay/create-payment", orderController.createVNPayPayment);
router.get("/vnpay/verify", orderController.verifyVNPayPayment);

// Admin stats — must be before parameterised routes
router.get("/admin/stats", orderController.getAdminStats);

// Customer orders — before generic /:id
router.get("/customer/:customer_id", orderController.getOrdersByCustomer);

// Seller APIs — stats phải đứng trước route có tham số :seller_id
router.get("/seller/:seller_id/stats", orderController.getSellerStats);
router.get("/seller/:seller_id", orderController.getOrdersBySeller);
router.post("/:id/cancel", orderController.cancelOrderByCustomer);
router.put("/:id/status", orderController.updateOrderStatus);

// Notifications
router.get("/notifications/:userId", notificationController.getNotifications);
router.patch("/notifications/:id/read", notificationController.markAsRead);
router.patch("/notifications/user/:userId/read-all", notificationController.markAllAsRead);

module.exports = router;
