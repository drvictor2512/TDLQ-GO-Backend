const Review = require("../models/review.model");
const Product = require("../models/product.model");

exports.getReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const reviews = await Review.find({ product_id: id }).sort({ createdAt: -1 });
    return res.status(200).json({ data: reviews, total: reviews.length });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.createReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, rating, comment } = req.body;

    if (!user_id) {
      return res.status(400).json({ message: "user_id là bắt buộc" });
    }
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Đánh giá phải từ 1 đến 5 sao" });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    const review = await Review.create({ product_id: id, user_id, rating, comment });

    const [agg] = await Review.aggregate([
      { $match: { product_id: review.product_id } },
      { $group: { _id: null, avg: { $avg: "$rating" } } },
    ]);
    if (agg) {
      await Product.findByIdAndUpdate(id, {
        rating_average: Math.round(agg.avg * 10) / 10,
      });
    }

    return res.status(201).json({ message: "Đánh giá thành công", data: review });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
