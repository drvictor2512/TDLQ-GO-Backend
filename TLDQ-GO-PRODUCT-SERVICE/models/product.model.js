const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    seller_id: {
      type: String,
      required: true,
    },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      default: 0,
    },
    stock_quantity: {
      type: Number,
      default: 0,
    },
    rating_average: {
      type: Number,
      default: 0,
    },
    images: {
      type: [String],
      default: [],
    },

    // ✅ THÊM MÔ TẢ
    description: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Product", productSchema);
