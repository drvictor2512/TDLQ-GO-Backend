const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order.controller");

router.post("/", orderController.createOrder);
router.get("/", orderController.getOrders);

// Seller APIs
router.get("/seller/:seller_id", orderController.getOrdersBySeller);
router.put("/:id/status", orderController.updateOrderStatus);

module.exports = router;
