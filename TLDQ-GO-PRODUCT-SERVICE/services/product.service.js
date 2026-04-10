const Product = require("../models/product.model");

exports.getAll = async () => {
  return await Product.find().lean();
};

exports.getById = async (id) => {
  const product = await Product.findById(id).lean();
  if (!product) {
    const error = new Error("Sản phẩm không tồn tại");
    error.status = 404;
    throw error;
  }
  return product;
};

exports.create = async (data) => {
  const { seller_id, category_id, name, price, stock_quantity, images } = data;

  if (!seller_id || !name) {
    const error = new Error("Thiếu seller_id hoặc name");
    error.status = 400;
    throw error;
  }

  const product = new Product({
    seller_id,
    category_id,
    name,
    price,
    stock_quantity,
    images,
  });

  return await product.save();
};

exports.update = async (id, data) => {
  const product = await Product.findByIdAndUpdate(id, data, { new: true });
  if (!product) {
    const error = new Error("Sản phẩm không tồn tại");
    error.status = 404;
    throw error;
  }
  return product;
};

exports.remove = async (id) => {
  const product = await Product.findByIdAndDelete(id);
  if (!product) {
    const error = new Error("Sản phẩm không tồn tại");
    error.status = 404;
    throw error;
  }
  return product;
};
