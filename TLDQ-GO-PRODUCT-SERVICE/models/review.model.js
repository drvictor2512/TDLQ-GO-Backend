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

// getReviews: find({ product_id }).sort({ createdAt: -1 })
// getSellerReviews: find({ product_id: { $in: [...] } })
reviewSchema.index({ product_id: 1, createdAt: -1 });

module.exports = mongoose.model("Review", reviewSchema);
