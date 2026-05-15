require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const mongoose = require("mongoose");
const connectDB = require("./config/db");
const productRoutes = require("./routes/product.routes");
const categoryRoutes = require("./routes/category.routes");
const voucherRoutes = require("./routes/voucher.routes");
const reviewRoutes = require("./routes/review.routes");
const adminProductRoutes = require("./routes/admin.product.route");
const { startOrderConsumer } = require("./consumers/orderConsumer");

const app = express();

connectDB();

// Khởi động RabbitMQ consumer — lắng nghe order events ở background
startOrderConsumer().catch((err) => {
  console.error("[OrderConsumer] Khởi động thất bại:", err.message);
  // Không thoát process — HTTP endpoints vẫn hoạt động bình thường
});

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use("/", adminProductRoutes);
app.use("/", categoryRoutes);
app.use("/", productRoutes);
app.use("/", voucherRoutes);
app.use("/", reviewRoutes);

app.get("/health", (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "degraded",
    service: "product-service",
    uptime: Math.floor(process.uptime()),
    db: dbOk ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "product-service" });
});

const PORT = process.env.PRODUCT_SERVICE_PORT || 3002;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
