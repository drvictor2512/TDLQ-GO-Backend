const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    user_id: String,
    rating: Number,
    comment: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Review", reviewSchema);
