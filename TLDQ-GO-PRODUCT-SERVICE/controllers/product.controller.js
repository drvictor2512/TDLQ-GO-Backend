const productService = require("../services/product.service");
const cloudinary = require("../config/cloudinary");
const Product = require("../models/product.model");
const Voucher = require("../models/voucher.model");
const Category = require("../models/category.model");
const FlashSale = require("../models/flashSale.model");
const {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
} = require("../config/redis");

const CACHE_TTL = 5; // 0.5s

const getVoucherDisplayData = async (products) => {
  const productList = Array.isArray(products) ? products : [];

  if (productList.length === 0) {
    return productList;
  }

  const now = new Date();
  const sellerIds = [
    ...new Set(
      productList.map((item) => String(item.seller_id || "")).filter(Boolean),
    ),
  ];

  if (sellerIds.length === 0) {
    return productList.map((item) => {
      const plainItem =
        typeof item.toObject === "function" ? item.toObject() : { ...item };
      const originalPrice = Number(plainItem.price || 0);

      return {
        ...plainItem,
        original_price: originalPrice,
        discount_price: originalPrice,
        applied_voucher: null,
      };
    });
  }

  const vouchers = await Voucher.find({
    seller_id: { $in: sellerIds },
    start_date: { $lte: now },
    end_date: { $gte: now },
    quantity: { $gt: 0 },
  }).populate("product_ids", "_id");

  return productList.map((item) => {
    const plainItem =
      typeof item.toObject === "function" ? item.toObject() : { ...item };
    const productId = String(plainItem._id);
    const originalPrice = Number(plainItem.price || 0);

    const applicableVouchers = vouchers.filter((voucher) => {
      if (String(voucher.seller_id) !== String(plainItem.seller_id)) {
        return false;
      }

      if (voucher.apply_scope === "all") {
        return true;
      }

      return (voucher.product_ids || []).some((voucherProduct) => {
        const voucherProductId = String(voucherProduct?._id || voucherProduct);
        return voucherProductId === productId;
      });
    });

    const selectedVoucher = applicableVouchers.sort((left, right) => {
      const discountDiff =
        Number(right.discount_percent || 0) -
        Number(left.discount_percent || 0);
      if (discountDiff !== 0) {
        return discountDiff;
      }

      return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
    })[0];

    const discountPercent = Number(selectedVoucher?.discount_percent || 0);
    const discountPrice = selectedVoucher
      ? Math.max(0, Math.round((originalPrice * (100 - discountPercent)) / 100))
      : originalPrice;

    return {
      ...plainItem,
      original_price: originalPrice,
      discount_price: discountPrice,
      applied_voucher: selectedVoucher
        ? {
            _id: selectedVoucher._id,
            name: selectedVoucher.name,
            discount_percent: selectedVoucher.discount_percent,
            apply_scope: selectedVoucher.apply_scope,
          }
        : null,
    };
  });
};

//
// GET ALL
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("category_id");
    const productsWithVoucher = await getVoucherDisplayData(products);

    return res.status(200).json({
      message: "Lấy danh sách sản phẩm thành công",
      data: productsWithVoucher,
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
    const cacheKey = `product:${req.params.id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.status(200).json(cached);

    const product = await Product.findById(req.params.id).populate(
      "category_id",
    );
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    const productsWithVoucher = await getVoucherDisplayData([product]);
    const payload = {
      message: "Lấy chi tiết sản phẩm thành công",
      data: productsWithVoucher[0],
    };

    await cacheSet(cacheKey, payload, CACHE_TTL);
    return res.status(200).json(payload);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

//
//
exports.createProduct = async (req, res) => {
  try {
    const { name, price, stock_quantity, seller_id, category_id, description } =
      req.body;

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
      description,
      images: imageUrls,
      sold: 0,
      status: "approved",
    });

    // Xóa cache danh sách — sản phẩm mới làm lỗi thời tất cả các trang
    await cacheDelPattern("products:page:*");

    return res.status(201).json({
      message: "Tạo sản phẩm thành công",
      data: newProduct,
    });
  } catch (error) {
    console.error("🔥 Create product error:", error);
    return res
      .status(500)
      .json({ message: "Create product failed", error: error.message });
  }
};

//
// UPDATE PRODUCT
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await Product.findById(id);

    if (!existing) {
      return res.status(404).json({
        message: "Không tìm thấy sản phẩm",
      });
    }

    const payload = { ...req.body };

    if (req.file) {
      const imageUrl = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "products" },
          (error, result) => {
            if (error) return reject(error);
            resolve(result.secure_url);
          },
        );

        stream.end(req.file.buffer);
      });

      const oldImages = Array.isArray(existing.images) ? existing.images : [];
      payload.images = [imageUrl, ...oldImages.slice(1)];
    }

    const updated = await Product.findByIdAndUpdate(id, payload, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({
        message: "Không tìm thấy sản phẩm",
      });
    }

    await cacheDel(`product:${id}`);
    await cacheDelPattern("products:page:*");

    return res
      .status(200)
      .json({ message: "Cập nhật sản phẩm thành công", data: updated });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

// DELETE PRODUCT
exports.deleteProduct = async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    await cacheDel(`product:${req.params.id}`);
    await cacheDelPattern("products:page:*");

    return res
      .status(200)
      .json({ message: "Xóa sản phẩm thành công", data: deleted });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

//
// PAGINATION 10 sản phẩm / trang)
exports.getProductsWithPage = async (req, res) => {
  try {
    let { page = 1 } = req.query;
    page = parseInt(page);

    if (page < 1) {
      return res.status(400).json({ message: "Page không hợp lệ" });
    }

    const cacheKey = `products:page:${page}:approved`;
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return res.status(200).json(cached);
    }

    const limit = 10;
    const skip = (page - 1) * limit;

    // 🔥 CHỈ LẤY PRODUCT ĐÃ APPROVED
    const filter = {
      status: "approved",
    };

    const total = await Product.countDocuments(filter);

    const products = await Product.find(filter)
      .populate("category_id")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const productsWithVoucher = await getVoucherDisplayData(products);

    const payload = {
      message: "Lấy sản phẩm theo trang thành công",
      data: productsWithVoucher,
      pagination: {
        page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        limit,
      },
    };

    await cacheSet(cacheKey, payload, CACHE_TTL);

    return res.status(200).json(payload);
  } catch (error) {
    console.error("Get products error:", error);
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

// GET BY CATEGORY NAME
exports.getProductsByCategoryName = async (req, res) => {
  try {
    const { name } = req.params;
    let { page = 1 } = req.query;
    page = parseInt(page);

    if (page < 1) {
      return res.status(400).json({
        message: "Page không hợp lệ",
      });
    }

    const category = await Category.findOne({ name });

    if (!category) {
      return res.status(404).json({
        message: "Không tìm thấy danh mục",
      });
    }

    const limit = 10;
    const skip = (page - 1) * limit;

    const total = await Product.countDocuments({ category_id: category._id });

    const products = await Product.find({ category_id: category._id })
      .populate("category_id")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const productsWithVoucher = await getVoucherDisplayData(products);

    return res.status(200).json({
      message: "Lấy sản phẩm theo danh mục thành công",
      data: productsWithVoucher,
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

// UPDATE STOCK — internal endpoint called by order-service
// PATCH /products/:id/stock  body: { stock_delta, sold_delta }
exports.updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock_delta, sold_delta } = req.body;

    const inc = {};
    if (typeof stock_delta === "number") inc.stock_quantity = stock_delta;
    if (typeof sold_delta === "number") inc.sold = sold_delta;

    if (Object.keys(inc).length === 0) {
      return res
        .status(400)
        .json({ message: "stock_delta hoặc sold_delta là bắt buộc" });
    }

    // Luôn cập nhật, dùng $max để ngăn stock xuống dưới 0
    const update = { $inc: inc };
    if (inc.stock_quantity && inc.stock_quantity < 0) {
      // Sau khi $inc, nếu kết quả âm thì clamp về 0
      update.$max = { stock_quantity: 0 };
    }

    const updated = await Product.findByIdAndUpdate(id, update, { new: true });

    if (!updated) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    return res.status(200).json({
      message: "Cập nhật tồn kho thành công",
      data: {
        _id: updated._id,
        stock_quantity: updated.stock_quantity,
        sold: updated.sold,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

// SEARCH PRODUCTS — GET /products/search
exports.searchProducts = async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice, minRating, sort, page = 1, limit = 12 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

    const cacheKey = `search:${q || ""}:${category || ""}:${minPrice || ""}:${maxPrice || ""}:${minRating || ""}:${sort || ""}:${pageNum}:${limitNum}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.status(200).json(cached);

    const match = { status: "approved" };

    if (q && q.trim()) {
      match.name = { $regex: q.trim(), $options: "i" };
    }

    if (minPrice || maxPrice) {
      match.price = {};
      if (minPrice) match.price.$gte = Number(minPrice);
      if (maxPrice) match.price.$lte = Number(maxPrice);
    }

    if (minRating && Number(minRating) > 0) {
      match.rating_average = { $gte: Number(minRating) };
    }

    if (category && category.trim()) {
      const cat = await Category.findOne({ name: { $regex: category.trim(), $options: "i" } });
      if (cat) {
        match.category_id = cat._id;
      } else {
        const payload = {
          message: "Không tìm thấy danh mục",
          data: [],
          pagination: { page: pageNum, totalPages: 0, totalItems: 0, limit: limitNum },
        };
        return res.status(200).json(payload);
      }
    }

    const sortMap = {
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      best_seller: { sold: -1 },
      rating: { rating_average: -1 },
      newest: { createdAt: -1 },
    };
    const sortObj = sortMap[sort] || { createdAt: -1 };

    const skip = (pageNum - 1) * limitNum;
    const total = await Product.countDocuments(match);
    const products = await Product.find(match)
      .populate("category_id")
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum);

    const productsWithVoucher = await getVoucherDisplayData(products);

    const payload = {
      message: "Tìm kiếm sản phẩm thành công",
      data: productsWithVoucher,
      pagination: {
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        limit: limitNum,
      },
    };

    await cacheSet(cacheKey, payload, 120);
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// GET RELATED PRODUCTS — GET /products/:id/related
exports.getRelatedProducts = async (req, res) => {
  try {
    const { id } = req.params;

    const cacheKey = `related:${id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.status(200).json(cached);

    const product = await Product.findById(id).select("category_id");
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    const related = await Product.find({
      category_id: product.category_id,
      _id: { $ne: id },
      status: "approved",
    })
      .populate("category_id")
      .sort({ sold: -1 })
      .limit(8);

    const relatedWithVoucher = await getVoucherDisplayData(related);

    const payload = {
      message: "Lấy sản phẩm liên quan thành công",
      data: relatedWithVoucher,
    };

    await cacheSet(cacheKey, payload, 300);
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ message: "Lỗi server", error: error.message });
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

    const limit = 10;
    const skip = (page - 1) * limit;

    const total = await Product.countDocuments({ seller_id });

    const products = await Product.find({ seller_id })
      .populate("category_id")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const productsWithVoucher = await getVoucherDisplayData(products);

    return res.status(200).json({
      message: "Lấy sản phẩm của nhà bán thành công",
      data: productsWithVoucher,
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

// FLASH SALE — POST /products/flash-sales
exports.createFlashSale = async (req, res) => {
  try {
    const { product_id, seller_id, sale_price, start_time, end_time, quantity_limit } = req.body;
    if (!product_id || !seller_id || !sale_price || !start_time || !end_time) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
    }

    const product = await Product.findById(product_id);
    if (!product) return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    if (String(product.seller_id) !== String(seller_id)) {
      return res.status(403).json({ message: "Bạn không có quyền tạo flash sale cho sản phẩm này" });
    }

    const start = new Date(start_time);
    const end = new Date(end_time);
    const now = new Date();

    if (end <= start) return res.status(400).json({ message: "end_time phải sau start_time" });
    if (Number(sale_price) >= product.price) {
      return res.status(400).json({ message: "Giá sale phải thấp hơn giá gốc" });
    }

    const discount_percent = Math.round(((product.price - sale_price) / product.price) * 100);
    const status = now >= start ? "active" : "upcoming";

    const flashSale = await FlashSale.create({
      product_id,
      seller_id,
      original_price: product.price,
      sale_price: Number(sale_price),
      discount_percent,
      start_time: start,
      end_time: end,
      quantity_limit: quantity_limit || 0,
      status,
    });

    await cacheDel("flash-sales:active");
    return res.status(201).json({ message: "Tạo flash sale thành công", data: flashSale });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// FLASH SALE — GET /products/flash-sales/active
exports.getActiveFlashSales = async (req, res) => {
  try {
    const cacheKey = "flash-sales:active";
    const cached = await cacheGet(cacheKey);
    if (cached) return res.status(200).json(cached);

    const now = new Date();
    const flashSales = await FlashSale.find({
      end_time: { $gte: now },
      start_time: { $lte: now },
    })
      .populate("product_id")
      .sort({ createdAt: -1 })
      .limit(20);

    const payload = { message: "Lấy flash sale thành công", data: flashSales };
    await cacheSet(cacheKey, payload, 60);
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// FLASH SALE — GET /products/:id/flash-sale
exports.getFlashSaleByProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();
    const flashSale = await FlashSale.findOne({
      product_id: id,
      start_time: { $lte: now },
      end_time: { $gte: now },
    });
    return res.status(200).json({ data: flashSale || null });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// FLASH SALE — GET /products/flash-sales/seller/:sellerId
exports.getFlashSalesBySeller = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const flashSales = await FlashSale.find({ seller_id: sellerId })
      .populate("product_id", "name images price")
      .sort({ createdAt: -1 });
    return res.status(200).json({ data: flashSales });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// FLASH SALE — PATCH /products/flash-sales/:id
exports.updateFlashSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { seller_id, sale_price, start_time, end_time, quantity_limit } = req.body;

    const flashSale = await FlashSale.findById(id);
    if (!flashSale) return res.status(404).json({ message: "Không tìm thấy flash sale" });
    if (seller_id && String(flashSale.seller_id) !== String(seller_id)) {
      return res.status(403).json({ message: "Bạn không có quyền sửa flash sale này" });
    }

    if (sale_price !== undefined) {
      if (Number(sale_price) >= flashSale.original_price) {
        return res.status(400).json({ message: "Giá sale phải thấp hơn giá gốc" });
      }
      flashSale.sale_price = Number(sale_price);
      flashSale.discount_percent = Math.round(((flashSale.original_price - sale_price) / flashSale.original_price) * 100);
    }
    if (start_time) flashSale.start_time = new Date(start_time);
    if (end_time) {
      if (new Date(end_time) <= (start_time ? new Date(start_time) : flashSale.start_time)) {
        return res.status(400).json({ message: "end_time phải sau start_time" });
      }
      flashSale.end_time = new Date(end_time);
    }
    if (quantity_limit !== undefined) flashSale.quantity_limit = Number(quantity_limit);

    const now = new Date();
    if (now < flashSale.start_time) flashSale.status = "upcoming";
    else if (now <= flashSale.end_time) flashSale.status = "active";
    else flashSale.status = "ended";

    await flashSale.save();
    await cacheDel("flash-sales:active");
    return res.status(200).json({ message: "Cập nhật flash sale thành công", data: flashSale });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// FLASH SALE — DELETE /products/flash-sales/:id
exports.deleteFlashSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { seller_id } = req.body;

    const flashSale = await FlashSale.findById(id);
    if (!flashSale) return res.status(404).json({ message: "Không tìm thấy flash sale" });
    if (seller_id && String(flashSale.seller_id) !== String(seller_id)) {
      return res.status(403).json({ message: "Bạn không có quyền xóa flash sale này" });
    }

    await FlashSale.deleteOne({ _id: id });
    await cacheDel("flash-sales:active");
    return res.status(200).json({ message: "Xóa flash sale thành công" });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
