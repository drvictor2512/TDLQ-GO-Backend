const Product = require("../models/product.model");
const Voucher = require("../models/voucher.model");

const normalizeProductIds = (value) => {
    if (Array.isArray(value)) {
        return value.filter(Boolean).map(String);
    }

    if (typeof value !== "string" || value.trim() === "") {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return parsed.filter(Boolean).map(String);
        }
    } catch (error) {
        // Fallback to comma-separated strings.
    }

    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
};

const parseDate = (value) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

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
            const requestedProductIds = normalizeProductIds(product_ids);

            if (requestedProductIds.length === 0) {
                return res.status(400).json({
                    message: "Vui lòng chọn ít nhất 1 sản phẩm áp dụng",
                });
            }

            const products = await Product.find({
                _id: { $in: requestedProductIds },
                seller_id,
            }).select("_id");

            if (products.length !== requestedProductIds.length) {
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

exports.updateVoucher = async (req, res) => {
    try {
        const { id } = req.params;
        const voucher = await Voucher.findById(id);

        if (!voucher) {
            return res.status(404).json({
                message: "Không tìm thấy voucher",
            });
        }

        const requestSellerId = req.body.seller_id ? String(req.body.seller_id).trim() : "";
        if (requestSellerId && requestSellerId !== String(voucher.seller_id)) {
            return res.status(403).json({
                message: "Bạn không có quyền cập nhật voucher này",
            });
        }

        const nextSellerId = String(voucher.seller_id);
        const nextName = req.body.name !== undefined ? String(req.body.name).trim() : voucher.name;
        const nextStartDate = req.body.start_date !== undefined ? parseDate(req.body.start_date) : voucher.start_date;
        const nextEndDate = req.body.end_date !== undefined ? parseDate(req.body.end_date) : voucher.end_date;
        const nextPercent = req.body.discount_percent !== undefined ? Number(req.body.discount_percent) : Number(voucher.discount_percent);
        const nextQuantity = req.body.quantity !== undefined ? Number(req.body.quantity) : Number(voucher.quantity);
        const nextScope = req.body.apply_scope !== undefined
            ? (req.body.apply_scope === "specific" ? "specific" : "all")
            : voucher.apply_scope;

        if (!nextName) {
            return res.status(400).json({ message: "Tên voucher không được để trống" });
        }

        if (!nextStartDate || !nextEndDate) {
            return res.status(400).json({ message: "Ngày bắt đầu hoặc kết thúc không hợp lệ" });
        }

        if (nextEndDate <= nextStartDate) {
            return res.status(400).json({ message: "Thời gian kết thúc phải sau thời gian bắt đầu" });
        }

        if (Number.isNaN(nextPercent) || nextPercent < 1 || nextPercent > 100) {
            return res.status(400).json({ message: "Phần trăm giảm phải từ 1 đến 100" });
        }

        if (!Number.isInteger(nextQuantity) || nextQuantity < 1) {
            return res.status(400).json({ message: "Số lượng voucher phải là số nguyên dương" });
        }

        let nextProductIds = [];

        if (nextScope === "specific") {
            const requestedProductIds = req.body.product_ids !== undefined
                ? normalizeProductIds(req.body.product_ids)
                : voucher.product_ids.map((item) => item.toString());

            if (requestedProductIds.length === 0) {
                return res.status(400).json({
                    message: "Vui lòng chọn ít nhất 1 sản phẩm áp dụng",
                });
            }

            const products = await Product.find({
                _id: { $in: requestedProductIds },
                seller_id: nextSellerId,
            }).select("_id");

            if (products.length !== requestedProductIds.length) {
                return res.status(400).json({
                    message: "Có sản phẩm không hợp lệ hoặc không thuộc shop của bạn",
                });
            }

            nextProductIds = products.map((item) => item._id);
        }

        voucher.name = nextName;
        voucher.start_date = nextStartDate;
        voucher.end_date = nextEndDate;
        voucher.discount_percent = nextPercent;
        voucher.quantity = nextQuantity;
        voucher.apply_scope = nextScope;
        voucher.product_ids = nextProductIds;

        await voucher.save();

        return res.status(200).json({
            message: "Cập nhật voucher thành công",
            data: voucher,
        });
    } catch (error) {
        console.error("Update voucher error:", error);
        return res.status(500).json({
            message: "Lỗi server",
            error: error.message,
        });
    }
};

exports.deleteVoucher = async (req, res) => {
    try {
        const { id } = req.params;
        const voucher = await Voucher.findById(id);

        if (!voucher) {
            return res.status(404).json({
                message: "Không tìm thấy voucher",
            });
        }

        const requestSellerId = req.body.seller_id
            ? String(req.body.seller_id).trim()
            : req.query.seller_id
                ? String(req.query.seller_id).trim()
                : "";

        if (requestSellerId && requestSellerId !== String(voucher.seller_id)) {
            return res.status(403).json({
                message: "Bạn không có quyền xóa voucher này",
            });
        }

        await voucher.deleteOne();

        return res.status(200).json({
            message: "Xóa voucher thành công",
        });
    } catch (error) {
        console.error("Delete voucher error:", error);
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
