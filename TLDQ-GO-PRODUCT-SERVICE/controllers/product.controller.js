const Product = require("../models/product.model");

// CREATE PRODUCT
const createProduct = async (req, res) => {
  try {
    const { seller_id, category_id, name, price, stock_quantity, images } =
      req.body;

    // validate đơn giản
    if (!seller_id || !name) {
      return res.status(400).json({
        message: "Thiếu seller_id hoặc name",
      });
    }

    const product = new Product({
      seller_id,
      category_id,
      name,
      price,
      stock_quantity,
      images,
    });

    const saved = await product.save();

    res.status(201).json({
      message: "Tạo sản phẩm thành công",
      data: saved,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

module.exports = {
  createProduct,
};
