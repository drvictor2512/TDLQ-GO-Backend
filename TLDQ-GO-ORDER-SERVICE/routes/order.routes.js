const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order.controller");

router.post("/", orderController.createOrder);
router.get("/", orderController.getOrders);

// Admin stats — must be before parameterised routes
router.get("/admin/stats", orderController.getAdminStats);

// Seller APIs — stats phải đứng trước route có tham số :seller_id
router.get("/seller/:seller_id/stats", orderController.getSellerStats);
router.get("/seller/:seller_id", orderController.getOrdersBySeller);
router.put("/:id/status", orderController.updateOrderStatus);

module.exports = router;
