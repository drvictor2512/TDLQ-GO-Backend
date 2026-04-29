const Product = require("../models/product.model");
const Voucher = require("../models/voucher.model");

exports.createVoucher = async (req, res) => {
    try {
        const {
            seller_id,
            name,
            start_date,
            end_date,
            discount_percent,
            quantity,
            apply_scope,
            product_ids,
        } = req.body;

        if (!seller_id || !name || !start_date || !end_date) {
            return res.status(400).json({
                message: "Thiếu thông tin bắt buộc",
            });
        }

        const start = new Date(start_date);
        const end = new Date(end_date);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return res.status(400).json({
                message: "Ngày bắt đầu hoặc kết thúc không hợp lệ",
            });
        }

        if (end <= start) {
            return res.status(400).json({
                message: "Thời gian kết thúc phải sau thời gian bắt đầu",
            });
        }

        const percent = Number(discount_percent);
        const qty = Number(quantity);

        if (Number.isNaN(percent) || percent < 1 || percent > 100) {
            return res.status(400).json({
                message: "Phần trăm giảm phải từ 1 đến 100",
            });
        }

        if (!Number.isInteger(qty) || qty < 1) {
            return res.status(400).json({
                message: "Số lượng voucher phải là số nguyên dương",
            });
        }

        const normalizedScope = apply_scope === "specific" ? "specific" : "all";
        let normalizedProductIds = [];

        if (normalizedScope === "specific") {
            if (!Array.isArray(product_ids) || product_ids.length === 0) {
                return res.status(400).json({
                    message: "Vui lòng chọn ít nhất 1 sản phẩm áp dụng",
                });
            }

            const products = await Product.find({
                _id: { $in: product_ids },
                seller_id,
            }).select("_id");

            if (products.length !== product_ids.length) {
                return res.status(400).json({
                    message: "Có sản phẩm không hợp lệ hoặc không thuộc shop của bạn",
                });
            }

            normalizedProductIds = products.map((p) => p._id);
        }

        const voucher = await Voucher.create({
            seller_id,
            name: String(name).trim(),
            start_date: start,
            end_date: end,
            discount_percent: percent,
            quantity: qty,
            apply_scope: normalizedScope,
            product_ids: normalizedProductIds,
        });

        return res.status(201).json({
            message: "Tạo voucher thành công",
            data: voucher,
        });
    } catch (error) {
        console.error("Create voucher error:", error);
        return res.status(500).json({
            message: "Lỗi server",
            error: error.message,
        });
    }
};

exports.getVouchersBySeller = async (req, res) => {
    try {
        const { seller_id } = req.params;

        const vouchers = await Voucher.find({ seller_id })
            .populate("product_ids", "_id name images price")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            message: "Lấy danh sách voucher thành công",
            data: vouchers,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Lỗi server",
            error: error.message,
        });
    }
};
