const express = require("express");
const router = express.Router();

const {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} = require("../controllers/category.controller");

router.post("/products/categories", createCategory);
router.get("/products/categories", getAllCategories);
router.get("/products/categories/:id", getCategoryById);
router.put("/products/categories/:id", updateCategory);
router.delete("/products/categories/:id", deleteCategory);

module.exports = router;
