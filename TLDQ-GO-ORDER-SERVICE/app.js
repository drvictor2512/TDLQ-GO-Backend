const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
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

app.get("/", (req, res) => {
  res.send("order service running");
});

const PORT = process.env.ORDER_SERVICE_PORT || 3003;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
