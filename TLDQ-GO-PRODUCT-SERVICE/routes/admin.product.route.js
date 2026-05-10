const express = require("express");
const router = express.Router();

const {
  adminGetProducts,
  adminApproveProduct,
  adminRejectProduct,
  adminDeleteProduct,
  adminGetProductById,
} = require("../controllers/admin.product.controller");

// 📌 LIST + SEARCH + FILTER
router.get("/products/admin", adminGetProducts);

// 📌 DETAIL
router.get("/products/:id/admin", adminGetProductById);

// 📌 APPROVE
router.patch("/products/:id/approve", adminApproveProduct);

// 📌 REJECT
router.patch("/products/:id/reject", adminRejectProduct);

// 📌 DELETE
router.delete("/products/:id/admin", adminDeleteProduct);

module.exports = router;
