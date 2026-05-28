const Product = require("../models/product.model");

// 📌 GET LIST (search + filter + pagination)
exports.adminGetProducts = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const keyword = (req.query.keyword || "").trim();
    const status = req.query.status;

    const filter = {};

    if (keyword) {
      filter.name = { $regex: keyword, $options: "i" };
    }

    if (status && status !== "all") {
      filter.status = status;
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("category_id", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      items: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📌 APPROVE PRODUCT
exports.adminApproveProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndUpdate(
      id,
      { status: "approved" },
      { new: true },
    );

    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    return res.status(200).json({
      message: "Duyệt sản phẩm thành công",
      product,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📌 REJECT PRODUCT
exports.adminRejectProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndUpdate(
      id,
      { status: "rejected" },
      { new: true },
    );

    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    return res.status(200).json({
      message: "Từ chối sản phẩm",
      product,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📌 DELETE PRODUCT
exports.adminDeleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    return res.status(200).json({
      message: "Xóa sản phẩm thành công",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📌 GET DETAIL (optional)
exports.adminGetProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();

    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    return res.status(200).json({ product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
