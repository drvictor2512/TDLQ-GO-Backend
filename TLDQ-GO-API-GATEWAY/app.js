require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { v4: uuidv4 } = require("uuid");
const http = require("http");
const https = require("https");
const { Server } = require("socket.io");

const app = express();
const USER_SERVICE_URL = process.env.USER_SERVICE;
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE;
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE;
const CART_SERVICE_URL = process.env.CART_SERVICE;

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── Correlation ID — mỗi request có 1 ID duy nhất để trace across services ───
app.use((req, res, next) => {
  req.requestId = req.headers["x-request-id"] || uuidv4();
  res.setHeader("X-Request-ID", req.requestId);
  next();
});

// ── Rate limiting ─────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Quá nhiều yêu cầu. Vui lòng thử lại sau." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút." },
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút." },
});

app.use(generalLimiter);

// Auth endpoints — giới hạn nghiêm hơn
app.use("/api/users/login", authLimiter);
app.use("/api/users/user/login", authLimiter);
app.use("/api/users/seller/login", authLimiter);
app.use("/api/users/admin/login", authLimiter);
app.use("/api/users/register", authLimiter);
app.use("/api/users/user/register", authLimiter);
app.use("/api/users/seller/register", authLimiter);
app.use("/api/users/forgot-password", strictLimiter);

// ── Standard middleware ───────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// ── Helper: forward request to downstream service ────────────────────────────
async function forwardRequest(req, res, target, transformPath) {
  if (!target) {
    return res.status(503).json({ success: false, message: "Service not configured" });
  }
  try {
    const incomingPath = req.originalUrl;
    const forwardedPath = transformPath ? transformPath(incomingPath) : incomingPath;
    const url = `${target}${forwardedPath}`;
    console.log(`[GATEWAY] [${req.requestId}] -> ${req.method} ${incomingPath} -> ${url}`);

    // For multipart/form-data (file uploads), pipe the raw request
    if (req.is("multipart/form-data")) {
      return new Promise((resolve, reject) => {
        const targetUrl = new URL(url);
        const protocol = targetUrl.protocol === "https:" ? https : http;

        const options = {
          method: req.method,
          headers: {
            ...req.headers,
            host: targetUrl.host,
            "x-request-id": req.requestId,
          },
          timeout: 30000,
        };

        const proxyReq = protocol.request(targetUrl, options, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
          proxyRes.on("end", resolve);
        });

        proxyReq.on("error", (error) => {
          console.error(`[GATEWAY] [${req.requestId}] Proxy error: ${error.message}`);
          res.status(502).json({ success: false, message: "Service unavailable" });
          reject(error);
        });

        req.pipe(proxyReq);
      });
    }

    // For JSON/form-urlencoded, use axios
    const config = {
      method: req.method,
      url: url,
      headers: {
        ...req.headers,
        host: new URL(target).host,
        "x-request-id": req.requestId,
      },
      data: req.body,
      timeout: 30000,
    };

    const response = await axios(config);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(`[GATEWAY] [${req.requestId}] Error: ${error.message}`);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else if (!res.headersSent) {
      res.status(502).json({ success: false, message: "Service unavailable" });
    }
  }
}

/*
USER SERVICE
*/
app.use("/api/users", (req, res) => forwardRequest(req, res, USER_SERVICE_URL));

/*
PRODUCT SERVICE
*/
app.use("/api/products", (req, res) =>
  forwardRequest(req, res, PRODUCT_SERVICE_URL, (path) =>
    path.replace(/^\/api/, ""),
  ),
);

/*
ORDER SERVICE
*/
app.use("/api/orders", (req, res) =>
  forwardRequest(req, res, ORDER_SERVICE_URL, (path) =>
    path.replace(/^\/api/, ""),
  ),
);

/*
CART SERVICE
*/
app.use("/api/cart", (req, res) =>
  forwardRequest(req, res, CART_SERVICE_URL, (path) =>
    path.replace(/^\/api\/cart/, "/cart"),
  ),
);

/*
VOUCHER SERVICE (inside product service)
*/
app.use("/api/vouchers", (req, res) =>
  forwardRequest(req, res, PRODUCT_SERVICE_URL, (path) =>
    path.replace(/^\/api/, ""),
  ),
);

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "api-gateway" });
});

// ── Socket.io server ──────────────────────────────────────────────────────────
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  if (userId) {
    socket.join(`user:${userId}`);
    console.log(`[Socket.io] User ${userId} connected`);
  }
  socket.on("disconnect", () => {
    if (userId) console.log(`[Socket.io] User ${userId} disconnected`);
  });
});

// ── Internal notify endpoint — nhận từ Order Service, emit tới client ────────
app.post("/internal/notify", (req, res) => {
  const { targetUserId, type, title, message, orderId } = req.body;
  if (!targetUserId) {
    return res.status(400).json({ message: "targetUserId là bắt buộc" });
  }
  io.to(`user:${targetUserId}`).emit("notification", {
    type,
    title,
    message,
    orderId,
    createdAt: new Date().toISOString(),
  });
  res.json({ success: true });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});

const shutdown = (signal) => {
  console.log(`[${signal}] Graceful shutdown api-gateway...`);
  httpServer.close(() => {
    console.log("[api-gateway] HTTP server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
