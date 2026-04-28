const Voucher = require("../models/voucher.model");

exports.createVoucher = async (req, res) => {
  try {
    const { name, start_at, end_at, percent, quantity, applyTo, product_ids } = req.body;

    if (!name || !start_at || !end_at || percent == null) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
    }

    const voucher = await Voucher.create({
      name,
      start_at: new Date(start_at),
      end_at: new Date(end_at),
      percent: Number(percent),
      quantity: Number(quantity) || 1,
      applyTo: applyTo || "all",
      product_ids: Array.isArray(product_ids) ? product_ids : [],
    });

    return res.status(201).json({ message: "Tạo voucher thành công", data: voucher });
  } catch (error) {
    console.error("Create voucher error:", error);
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
