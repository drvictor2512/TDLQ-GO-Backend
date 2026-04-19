const productService = require("../services/product.service");
const cloudinary = require("../config/cloudinary");
const Product = require("../models/product.model");

//
// GET ALL
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("category_id");

    return res.status(200).json({
      message: "Lấy danh sách sản phẩm thành công",
      data: products,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

//
// GET BY ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "category_id",
    );

    if (!product) {
      return res.status(404).json({
        message: "Không tìm thấy sản phẩm",
      });
    }

    return res.status(200).json({
      message: "Lấy chi tiết sản phẩm thành công",
      data: product,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

//
// CREATE PRODUCT
exports.createProduct = async (req, res) => {
  try {
    const { name, price, stock_quantity, seller_id, category_id, description } =
      req.body;

    // validate
    if (!name || !seller_id) {
      return res.status(400).json({
        message: "Thiếu thông tin bắt buộc",
      });
    }

    let imageUrls = [];

    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map((file) => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "products" },
            (error, result) => {
              if (error) return reject(error);
              resolve(result.secure_url);
            },
          );

          stream.end(file.buffer);
        });
      });

      imageUrls = await Promise.all(uploadPromises);
    }

    const newProduct = await Product.create({
      name,
      price,
      stock_quantity,
      seller_id,
      category_id,
      description, // ✅ thêm
      images: imageUrls,
    });

    return res.status(201).json({
      message: "Tạo sản phẩm thành công",
      data: newProduct,
    });
  } catch (error) {
    console.error("🔥 Create product error:", error);

    return res.status(500).json({
      message: "Create product failed",
      error: error.message,
    });
  }
};

//
// UPDATE PRODUCT
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await Product.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({
        message: "Không tìm thấy sản phẩm",
      });
    }

    return res.status(200).json({
      message: "Cập nhật sản phẩm thành công",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

//
// DELETE PRODUCT
exports.deleteProduct = async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        message: "Không tìm thấy sản phẩm",
      });
    }

    return res.status(200).json({
      message: "Xóa sản phẩm thành công",
      data: deleted,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

//
// PAGINATION (8 sản phẩm / trang)
exports.getProductsWithPage = async (req, res) => {
  try {
    let { page = 1 } = req.query;
    page = parseInt(page);

    if (page < 1) {
      return res.status(400).json({
        message: "Page không hợp lệ",
      });
    }

    const limit = 8;
    const skip = (page - 1) * limit;

    const total = await Product.countDocuments();

    const products = await Product.find()
      .populate("category_id")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      message: "Lấy sản phẩm theo trang thành công",
      data: products,
      pagination: {
        page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        limit,
      },
    });
  } catch (error) {
    console.error("Get products error:", error);

    return res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

// GET BY SELLER
exports.getProductsBySeller = async (req, res) => {
  try {
    const { seller_id } = req.params;
    let { page = 1 } = req.query;
    page = parseInt(page);

    if (page < 1) {
      return res.status(400).json({ message: "Page không hợp lệ" });
    }

    const limit = 8;
    const skip = (page - 1) * limit;

    const total = await Product.countDocuments({ seller_id });

    const products = await Product.find({ seller_id })
      .populate("category_id")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      message: "Lấy sản phẩm của nhà bán thành công",
      data: products,
      pagination: {
        page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        limit,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};
