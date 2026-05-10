const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
const EXCHANGE_NAME = "order_events";
const EXCHANGE_TYPE = "direct";
const QUEUE_NAME = "product_stock_queue";
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;

/**
 * Kết nối đến RabbitMQ, khai báo exchange và queue, sau đó bind các routing keys.
 * Có retry logic để đợi RabbitMQ container khởi động xong.
 * @param {Function} onMessage - Callback xử lý khi nhận được message
 */
async function connectAndConsume(onMessage, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[RabbitMQ Consumer] Đang kết nối... (lần thử ${attempt}/${retries})`);
      const connection = await amqp.connect(RABBITMQ_URL);
      const channel = await connection.createChannel();

      // Khai báo exchange — phải khớp với bên Order Service
      await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, { durable: true });

      // Khai báo queue durable — không mất message khi service restart
      const { queue } = await channel.assertQueue(QUEUE_NAME, { durable: true });

      // Bind queue với tất cả routing keys của order events
      const routingKeys = ["order.created", "order.cancelled", "order.completed"];
      for (const key of routingKeys) {
        await channel.bindQueue(queue, EXCHANGE_NAME, key);
        console.log(`[RabbitMQ Consumer] ✅ Bound queue "${QUEUE_NAME}" ← "${key}"`);
      }

      // prefetch(1): mỗi lần chỉ xử lý 1 message — đảm bảo không bị overwhelm
      channel.prefetch(1);

      console.log(`[RabbitMQ Consumer] 🎧 Đang lắng nghe queue: "${QUEUE_NAME}"`);

      channel.consume(queue, async (msg) => {
        if (!msg) return;
        try {
          const payload = JSON.parse(msg.content.toString());
          await onMessage(msg.fields.routingKey, payload);
          // Xác nhận đã xử lý xong — message sẽ bị xóa khỏi queue
          channel.ack(msg);
        } catch (err) {
          console.error("[RabbitMQ Consumer] Lỗi xử lý message:", err.message);
          // nack(msg, false, true) — đưa message lại về đầu queue để retry
          channel.nack(msg, false, true);
        }
      });

      // Xử lý mất kết nối bất ngờ — tự reconnect
      connection.on("close", () => {
        console.warn("[RabbitMQ Consumer] ⚠️  Kết nối bị đóng. Đang reconnect...");
        setTimeout(() => connectAndConsume(onMessage), RETRY_DELAY_MS);
      });

      connection.on("error", (err) => {
        console.error("[RabbitMQ Consumer] Lỗi kết nối:", err.message);
      });

      return;
    } catch (err) {
      console.warn(`[RabbitMQ Consumer] Kết nối thất bại (lần ${attempt}): ${err.message}`);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        console.error("[RabbitMQ Consumer] ❌ Không thể kết nối sau tất cả các lần thử.");
        throw err;
      }
    }
  }
}

module.exports = { connectAndConsume, QUEUE_NAME, EXCHANGE_NAME };
