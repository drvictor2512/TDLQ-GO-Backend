require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cartRoutes = require("./routes/cart.routes");
const { client: redisClient } = require("./config/redis");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/cart", cartRoutes);

app.get("/health", (_req, res) => {
  const redisOk = redisClient.status === "ready";
  res.status(redisOk ? 200 : 503).json({
    status: redisOk ? "ok" : "degraded",
    service: "cart-service",
    uptime: Math.floor(process.uptime()),
    redis: redisOk ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

const PORT = process.env.CART_SERVICE_PORT || 3004;

const server = app.listen(PORT, () => console.log(`[CartService] running on port ${PORT}`));

const shutdown = (signal) => {
  console.log(`[${signal}] Graceful shutdown cart-service...`);
  server.close(() => {
    redisClient.quit().finally(() => {
      console.log("[cart-service] Redis closed");
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 10_000);
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
