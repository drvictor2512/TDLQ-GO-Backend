const express = require("express");
const router = express.Router();

const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });

const {
  getProductsWithPage,
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsBySeller,
  getProductsByCategoryName,
  updateStock,
  searchProducts,
  getRelatedProducts,
  createFlashSale,
  getActiveFlashSales,
  getFlashSaleByProduct,
  getFlashSalesBySeller,
  updateFlashSale,
  deleteFlashSale,
} = require("../controllers/product.controller");

const { aiChat, aiHistory } = require("../controllers/ai.controller");

// GET
router.get("/products", getAllProducts);

// AI chatbox
router.post("/products/ai/chat", aiChat);
router.get("/products/ai/history", aiHistory);

// PUT
router.put("/products/:id", upload.single("image"), updateProduct);

// DELETE
router.delete("/products/:id", deleteProduct);
// POST (upload ảnh)

router.post("/products", upload.array("images", 5), createProduct);
router.get("/products/page", getProductsWithPage);
router.get("/products/search", searchProducts);
router.get("/products/seller/:seller_id", getProductsBySeller);
router.get("/products/category/name/:name", getProductsByCategoryName);

router.patch("/products/:id/stock", updateStock);
router.get("/products/:id/related", getRelatedProducts);
router.get("/products/:id/flash-sale", getFlashSaleByProduct);

// Flash sale routes — phải đặt TRƯỚC /:id để tránh conflict
router.post("/products/flash-sales", createFlashSale);
router.get("/products/flash-sales/active", getActiveFlashSales);
router.get("/products/flash-sales/seller/:sellerId", getFlashSalesBySeller);
router.patch("/products/flash-sales/:id", updateFlashSale);
router.delete("/products/flash-sales/:id", deleteFlashSale);

router.get("/products/:id", getProductById);
module.exports = router;
