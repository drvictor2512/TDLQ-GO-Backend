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
} = require("../controllers/product.controller");

// GET
router.get("/products", getAllProducts);

// PUT (support single image upload)
router.put("/products/:id", upload.single("image"), updateProduct);

// DELETE
router.delete("/products/:id", deleteProduct);
// POST (upload single image)
router.post("/products", upload.single("image"), createProduct);
router.get("/products/page", getProductsWithPage);
router.get("/products/seller/:seller_id", getProductsBySeller);

router.get("/products/:id", getProductById);
module.exports = router;
