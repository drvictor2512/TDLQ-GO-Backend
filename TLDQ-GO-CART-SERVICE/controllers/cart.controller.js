const { getCart, saveCart, deleteCart } = require("../config/redis");

const PRODUCT_SERVICE_URL =
  process.env.PRODUCT_SERVICE_URL || "http://product:3002";

// Lấy giỏ hàng
exports.getCart = async (req, res) => {
  try {
    const cart = await getCart(req.params.userId);
    return res.status(200).json({ success: true, data: cart });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Thêm / cập nhật item trong giỏ
// POST /cart/:userId/items  body: { product_id, quantity }
exports.addItem = async (req, res) => {
  try {
    const { userId } = req.params;
    const { product_id, quantity = 1 } = req.body;

    if (!product_id) {
      return res.status(400).json({ success: false, message: "product_id là bắt buộc" });
    }
    if (quantity < 1) {
      return res.status(400).json({ success: false, message: "Số lượng phải >= 1" });
    }

    // Lấy thông tin sản phẩm từ Product Service
    const productRes = await fetch(`${PRODUCT_SERVICE_URL}/products/${product_id}`);
    if (!productRes.ok) {
      return res.status(400).json({ success: false, message: "Không tìm thấy sản phẩm" });
    }
    const { data: product } = await productRes.json();

    if (product.stock_quantity < 1) {
      return res.status(400).json({ success: false, message: "Sản phẩm đã hết hàng" });
    }

    const cart = await getCart(userId);
    const existing = cart.items.find((i) => i.product_id === product_id);

    if (existing) {
      const newQty = existing.quantity + quantity;
      if (newQty > product.stock_quantity) {
        return res.status(400).json({
          success: false,
          message: `Tồn kho chỉ còn ${product.stock_quantity} sản phẩm`,
        });
      }
      existing.quantity = newQty;
      // Cập nhật giá khi giỏ thay đổi (giá có thể đổi do voucher)
      existing.price = product.price;
      existing.discount_price = product.discount_price ?? product.price;
    } else {
      cart.items.push({
        product_id,
        product_name: product.name,
        price: product.price,
        discount_price: product.discount_price ?? product.price,
        image: product.images?.[0] ?? "",
        seller_id: product.seller_id,
        quantity,
      });
    }

    cart.updatedAt = new Date().toISOString();
    await saveCart(userId, cart);

    return res.status(200).json({ success: true, data: cart });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Cập nhật số lượng
// PUT /cart/:userId/items/:productId  body: { quantity }
exports.updateItem = async (req, res) => {
  try {
    const { userId, productId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ success: false, message: "Số lượng phải >= 1" });
    }

    const cart = await getCart(userId);
    const item = cart.items.find((i) => i.product_id === productId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Sản phẩm không có trong giỏ" });
    }

    item.quantity = quantity;
    cart.updatedAt = new Date().toISOString();
    await saveCart(userId, cart);

    return res.status(200).json({ success: true, data: cart });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Xóa 1 item
// DELETE /cart/:userId/items/:productId
exports.removeItem = async (req, res) => {
  try {
    const { userId, productId } = req.params;
    const cart = await getCart(userId);
    cart.items = cart.items.filter((i) => i.product_id !== productId);
    cart.updatedAt = new Date().toISOString();
    await saveCart(userId, cart);
    return res.status(200).json({ success: true, data: cart });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Xóa toàn bộ giỏ (sau khi checkout)
// DELETE /cart/:userId
exports.clearCart = async (req, res) => {
  try {
    await deleteCart(req.params.userId);
    return res.status(200).json({ success: true, message: "Đã xóa giỏ hàng" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
