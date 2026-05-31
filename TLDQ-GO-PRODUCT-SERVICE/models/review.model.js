const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    user_id: String,
    user_name: String,
    rating: Number,
    comment: String,
    images: [String],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Review", reviewSchema);
