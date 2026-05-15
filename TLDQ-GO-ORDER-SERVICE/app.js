const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const orderRoutes = require("./routes/order.routes");
const { connectRabbitMQ } = require("./config/rabbitmq");

app.use(cors());
app.use(express.json());

connectDB();

// Khởi động kết nối RabbitMQ — publisher sẵn sàng trước khi nhận request
connectRabbitMQ().catch((err) => {
  console.error("[RabbitMQ] Khởi động thất bại:", err.message);
  // Không thoát process — service vẫn chạy, chỉ tắt tính năng RabbitMQ
});

app.use("/orders", orderRoutes);

app.get("/health", (req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  const status = dbOk ? "ok" : "degraded";
  res.status(dbOk ? 200 : 503).json({
    status,
    service: "order-service",
    uptime: Math.floor(process.uptime()),
    db: dbOk ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "order-service" });
});

const PORT = process.env.ORDER_SERVICE_PORT || 3003;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
