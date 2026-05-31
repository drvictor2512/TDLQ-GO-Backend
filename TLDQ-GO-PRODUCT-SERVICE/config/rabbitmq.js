const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
const EXCHANGE_NAME = "order_events";
const EXCHANGE_TYPE = "direct";
const QUEUE_NAME = "product_stock_queue_v2";
const DLX_NAME = "order_events_dlx";
const DLQ_NAME = "product_stock_dlq";
const MAX_MSG_RETRIES = 3;       // số lần retry mỗi message trước khi vào DLQ
const RETRY_BASE_DELAY_MS = 5000; // 5s, 10s, 15s
const MAX_CONNECT_RETRIES = 10;
const CONNECT_RETRY_DELAY_MS = 3000;

async function connectAndConsume(onMessage, retries = MAX_CONNECT_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[RabbitMQ Consumer] Đang kết nối... (lần thử ${attempt}/${retries})`);
      const connection = await amqp.connect(RABBITMQ_URL);
      const channel = await connection.createChannel();

      // ── Dead Letter Exchange (fanout → DLQ nhận tất cả failed messages) ─────
      await channel.assertExchange(DLX_NAME, "fanout", { durable: true });
      await channel.assertQueue(DLQ_NAME, { durable: true });
      await channel.bindQueue(DLQ_NAME, DLX_NAME, "");
      console.log(`[RabbitMQ Consumer] ✅ DLQ ready: "${DLQ_NAME}"`);

      // ── Main exchange ─────────────────────────────────────────────────────────
      await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, { durable: true });

      // Main queue khai báo x-dead-letter-exchange → nack(false,false) vào DLQ
      const { queue } = await channel.assertQueue(QUEUE_NAME, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": DLX_NAME,
        },
      });

      const routingKeys = ["order.created", "order.cancelled", "order.completed"];
      for (const key of routingKeys) {
        await channel.bindQueue(queue, EXCHANGE_NAME, key);
        console.log(`[RabbitMQ Consumer] ✅ Bound queue "${QUEUE_NAME}" ← "${key}"`);
      }

      channel.prefetch(1);
      console.log(`[RabbitMQ Consumer] 🎧 Đang lắng nghe queue: "${QUEUE_NAME}"`);

      channel.consume(queue, async (msg) => {
        if (!msg) return;

        const retryCount = Number(msg.properties.headers?.["x-retry-count"] || 0);

        try {
          const payload = JSON.parse(msg.content.toString());
          await onMessage(msg.fields.routingKey, payload);
          channel.ack(msg);
        } catch (err) {
          console.error(
            `[RabbitMQ Consumer] ❌ Lỗi xử lý message (retry ${retryCount}/${MAX_MSG_RETRIES}):`,
            err.message,
          );

          if (retryCount >= MAX_MSG_RETRIES) {
            // Vượt giới hạn retry → DLQ
            console.error(
              `[RabbitMQ Consumer] 💀 Message đưa vào DLQ sau ${MAX_MSG_RETRIES} lần thất bại`,
            );
            channel.nack(msg, false, false); // không requeue → DLX → DLQ
          } else {
            // Còn retry → republish với delay tăng dần
            const delay = (retryCount + 1) * RETRY_BASE_DELAY_MS;
            console.warn(
              `[RabbitMQ Consumer] 🔄 Sẽ retry sau ${delay / 1000}s (lần ${retryCount + 1}/${MAX_MSG_RETRIES})`,
            );

            setTimeout(() => {
              try {
                channel.publish(
                  EXCHANGE_NAME,
                  msg.fields.routingKey,
                  msg.content,
                  {
                    persistent: true,
                    headers: { "x-retry-count": retryCount + 1 },
                  },
                );
                channel.ack(msg);
              } catch (publishErr) {
                console.error("[RabbitMQ Consumer] Lỗi republish:", publishErr.message);
                channel.nack(msg, false, false); // republish fail → DLQ
              }
            }, delay);
          }
        }
      });

      connection.on("close", () => {
        console.warn("[RabbitMQ Consumer] ⚠️  Kết nối bị đóng. Đang reconnect...");
        setTimeout(() => connectAndConsume(onMessage), CONNECT_RETRY_DELAY_MS);
      });

      connection.on("error", (err) => {
        console.error("[RabbitMQ Consumer] Lỗi kết nối:", err.message);
      });

      return;
    } catch (err) {
      console.warn(`[RabbitMQ Consumer] Kết nối thất bại (lần ${attempt}): ${err.message}`);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, CONNECT_RETRY_DELAY_MS));
      } else {
        console.error("[RabbitMQ Consumer] ❌ Không thể kết nối sau tất cả các lần thử.");
        throw err;
      }
    }
  }
}

module.exports = { connectAndConsume, QUEUE_NAME, EXCHANGE_NAME, DLQ_NAME };
