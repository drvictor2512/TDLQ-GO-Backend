const Review = require("../models/review.model");
const Product = require("../models/product.model");
const cloudinary = require("../config/cloudinary");

const uploadToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "reviews" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });

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
    const { user_id, user_name, rating, comment } = req.body;

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

    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = await Promise.all(req.files.map((f) => uploadToCloudinary(f.buffer)));
    }

    const review = await Review.create({
      product_id: id,
      user_id,
      user_name: user_name || "Khách hàng",
      rating,
      comment,
      images: imageUrls,
    });

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

exports.getSellerReviews = async (req, res) => {
  try {
    const { seller_id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const products = await Product.find({ seller_id }).select("_id name images");
    if (!products.length) {
      return res.status(200).json({ data: [], total: 0, totalPages: 0, page });
    }

    const productMap = {};
    const productIds = products.map((p) => {
      productMap[p._id.toString()] = {
        name: p.name,
        image: p.images?.[0] || "",
      };
      return p._id;
    });

    const total = await Review.countDocuments({ product_id: { $in: productIds } });
    const reviews = await Review.find({ product_id: { $in: productIds } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const enriched = reviews.map((r) => ({
      ...r.toObject(),
      product_name: productMap[r.product_id?.toString()]?.name || "",
      product_image: productMap[r.product_id?.toString()]?.image || "",
    }));

    return res.status(200).json({
      data: enriched,
      total,
      totalPages: Math.ceil(total / limit),
      page,
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
