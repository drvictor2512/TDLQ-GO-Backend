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
} = require("../controllers/product.controller");

// GET
router.get("/products", getAllProducts);

// PUT
router.put("/products/:id", updateProduct);

// DELETE
router.delete("/products/:id", deleteProduct);
// POST (upload ảnh)

router.post("/products", upload.array("images", 5), createProduct);
router.get("/products/page", getProductsWithPage);

router.get("/products/:id", getProductById);
module.exports = router;
