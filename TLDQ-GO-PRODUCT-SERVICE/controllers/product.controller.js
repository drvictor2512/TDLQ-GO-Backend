const productService = require("../services/product.service");

exports.getAllProducts = async (req, res) => {
  try {
    const products = await productService.getAll();
    res.status(200).json({
      message: "Lấy danh sách sản phẩm thành công",
      data: products,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "Lỗi server",
    });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await productService.getById(req.params.id);
    res.status(200).json({
      message: "Lấy chi tiết sản phẩm thành công",
      data: product,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "Lỗi server",
    });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const saved = await productService.create(req.body);
    res.status(201).json({
      message: "Tạo sản phẩm thành công",
      data: saved,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "Lỗi server",
    });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const updated = await productService.update(req.params.id, req.body);
    res.status(200).json({
      message: "Cập nhật sản phẩm thành công",
      data: updated,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "Lỗi server",
    });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const deleted = await productService.remove(req.params.id);
    res.status(200).json({
      message: "Xóa sản phẩm thành công",
      data: deleted,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "Lỗi server",
    });
  }
};
