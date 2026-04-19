const Category = require("../models/category.model");

// CREATE
exports.createCategory = async (req, res) => {
  try {
    const { name, slug, parent_id, level } = req.body;

    const newCategory = await Category.create({
      name,
      slug,
      parent_id: parent_id || null,
      level,
    });

    return res.status(201).json({
      message: "Tạo category thành công",
      data: newCategory,
    });
  } catch (error) {
    console.error("Create category error:", error);
    return res.status(500).json({
      message: "Tạo category thất bại",
      error: error.message,
    });
  }
};

// GET ALL
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().populate("parent_id");

    return res.status(200).json({
      message: "Lấy danh sách category thành công",
      data: categories,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

// GET BY ID
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate(
      "parent_id",
    );

    return res.status(200).json({
      message: "Lấy category thành công",
      data: category,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

// UPDATE
exports.updateCategory = async (req, res) => {
  try {
    const updated = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    return res.status(200).json({
      message: "Cập nhật category thành công",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

// DELETE
exports.deleteCategory = async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      message: "Xóa category thành công",
      data: deleted,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};
