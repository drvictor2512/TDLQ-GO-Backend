const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
const EXCHANGE_NAME = "order_events";
const EXCHANGE_TYPE = "direct";
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;

let channel = null;

/**
 * Kết nối đến RabbitMQ và khai báo exchange "order_events".
 * Có retry logic (tối đa 10 lần) để đợi RabbitMQ container khởi động xong.
 */
async function connectRabbitMQ(retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[RabbitMQ] Đang kết nối... (lần thử ${attempt}/${retries})`);
      const connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();

      // Khai báo exchange durable — không mất khi RabbitMQ restart
      await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, { durable: true });

      console.log("[RabbitMQ] ✅ Kết nối thành công! Exchange:", EXCHANGE_NAME);

      // Xử lý mất kết nối bất ngờ — tự reconnect
      connection.on("close", () => {
        console.warn("[RabbitMQ] ⚠️  Kết nối bị đóng. Đang reconnect...");
        channel = null;
        setTimeout(() => connectRabbitMQ(), RETRY_DELAY_MS);
      });

      connection.on("error", (err) => {
        console.error("[RabbitMQ] Lỗi kết nối:", err.message);
      });

      return channel;
    } catch (err) {
      console.warn(`[RabbitMQ] Kết nối thất bại (lần ${attempt}): ${err.message}`);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        console.error("[RabbitMQ] ❌ Không thể kết nối sau tất cả các lần thử.");
        throw err;
      }
    }
  }
}

/**
 * Publish một event lên exchange "order_events".
 * @param {string} routingKey - Tên event: "order.created" | "order.cancelled" | "order.completed"
 * @param {object} payload    - Dữ liệu của event (sẽ được serialize thành JSON)
 */
function publishEvent(routingKey, payload) {
  if (!channel) {
    console.warn("[RabbitMQ] ⚠️  Channel chưa sẵn sàng, bỏ qua event:", routingKey);
    return;
  }

  try {
    const message = Buffer.from(JSON.stringify(payload));
    // persistent: true — message không mất khi RabbitMQ restart
    channel.publish(EXCHANGE_NAME, routingKey, message, { persistent: true });
    console.log(`[RabbitMQ] 📤 Published event: ${routingKey}`, payload);
  } catch (err) {
    console.error("[RabbitMQ] Lỗi khi publish event:", err.message);
  }
}

module.exports = { connectRabbitMQ, publishEvent, EXCHANGE_NAME };
