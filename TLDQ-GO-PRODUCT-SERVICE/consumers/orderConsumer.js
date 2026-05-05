const Product = require("../models/product.model");
const { connectAndConsume } = require("../config/rabbitmq");

/**
 * Handler xử lý các events nhận từ RabbitMQ.
 *
 * @param {string} routingKey - "order.created" | "order.cancelled" | "order.completed"
 * @param {object} payload    - { order_id, items: [{ product_id, quantity }] }
 */
async function handleOrderEvent(routingKey, payload) {
  const { order_id, items } = payload;

  console.log(`[OrderConsumer] 📨 Nhận event: ${routingKey} — order_id: ${order_id}`);

  if (!items || !Array.isArray(items) || items.length === 0) {
    console.warn("[OrderConsumer] ⚠️  Event không có items hợp lệ, bỏ qua.");
    return;
  }

  // Xử lý song song tất cả sản phẩm trong đơn hàng
  const updates = items.map(async (item) => {
    const { product_id, quantity } = item;
    try {
      let update;

      if (routingKey === "order.created") {
        // Trừ tồn kho
        update = { $inc: { stock_quantity: -Math.abs(quantity) } };
      } else if (routingKey === "order.cancelled") {
        // Hoàn lại tồn kho
        update = { $inc: { stock_quantity: Math.abs(quantity) } };
      } else if (routingKey === "order.completed") {
        // Cộng số đã bán
        update = { $inc: { sold: Math.abs(quantity) } };
      } else {
        console.warn(`[OrderConsumer] ⚠️  Routing key không xác định: ${routingKey}`);
        return;
      }

      // Thực hiện update. Chúng ta dùng findByIdAndUpdate với object update chuẩn.
      const updated = await Product.findByIdAndUpdate(
        product_id,
        update,
        { new: true, runValidators: true }
      );

      if (!updated) {
        console.warn(`[OrderConsumer] ⚠️  Không tìm thấy product_id: ${product_id}`);
        return;
      }

      console.log(
        `[OrderConsumer] ✅ [${routingKey}] "${updated.name}" — stock: ${updated.stock_quantity}, sold: ${updated.sold}`
      );
    } catch (err) {
      console.error(`[OrderConsumer] ❌ Lỗi update product ${product_id}:`, err.message);
      // Re-throw để RabbitMQ nack và retry message nếu cần
      throw err;
    }
  });

  await Promise.all(updates);
}

/**
 * Khởi động consumer — gọi hàm này trong app.js khi server start.
 */
async function startOrderConsumer() {
  await connectAndConsume(handleOrderEvent);
}

module.exports = { startOrderConsumer };
