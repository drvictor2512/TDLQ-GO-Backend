require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const mongoose = require("mongoose");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth.routes");

const app = express();

connectDB();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/users", authRoutes);

app.get("/health", (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "degraded",
    service: "user-service",
    uptime: Math.floor(process.uptime()),
    db: dbOk ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "user-service" });
});

const PORT = process.env.USER_SERVICE_PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const shutdown = (signal) => {
  console.log(`[${signal}] Graceful shutdown user-service...`);
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log("[user-service] DB closed");
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 10_000);
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
