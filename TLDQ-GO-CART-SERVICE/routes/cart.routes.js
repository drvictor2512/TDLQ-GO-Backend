const express = require("express");
const router = express.Router();
const {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
} = require("../controllers/cart.controller");

router.get("/:userId", getCart);
router.post("/:userId/items", addItem);
router.put("/:userId/items/:productId", updateItem);
router.delete("/:userId/items/:productId", removeItem);
router.delete("/:userId", clearCart);

module.exports = router;
