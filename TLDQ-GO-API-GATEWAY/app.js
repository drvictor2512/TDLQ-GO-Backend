require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const CircuitBreaker = require("opossum");
const { v4: uuidv4 } = require("uuid");
const http = require("http");
const https = require("https");
const { Server } = require("socket.io");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");

const app = express();
const USER_SERVICE_URL = process.env.USER_SERVICE;
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE;
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE;
const CART_SERVICE_URL = process.env.CART_SERVICE;

// ── API Docs (Swagger UI) — before rate limiter so it's never throttled ──────
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
  message: {
    success: false,
    message: "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.",
  },
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.",
  },
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

// ── Circuit Breaker ───────────────────────────────────────────────────────────
const BREAKER_OPTIONS = {
  timeout: false,               // dùng axios/http timeout, không dùng opossum timeout
  errorThresholdPercentage: 50, // 50% lỗi trong cửa sổ → mở circuit
  resetTimeout: 30_000,         // 30s trước khi half-open và thử lại
  volumeThreshold: 5,           // cần ít nhất 5 request trước khi tính tỉ lệ lỗi
};

function makeBreaker(name, target, transformPath) {
  const action = (req, res) => doForward(req, res, target, transformPath);
  const breaker = new CircuitBreaker(action, BREAKER_OPTIONS);

  breaker.on("open",     () => console.warn (`[CB] ⚡ OPEN     — ${name} service`));
  breaker.on("halfOpen", () => console.info  (`[CB] 🔄 HALF-OPEN — ${name} service`));
  breaker.on("close",    () => console.info  (`[CB] ✅ CLOSED   — ${name} service`));

  breaker.fallback((req, res) => {
    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        message: `${name} service tạm thời không khả dụng. Vui lòng thử lại sau.`,
      });
    }
  });

  return breaker;
}

// ── Helper: forward request — throws on network/5xx errors (cho circuit breaker) ─
async function doForward(req, res, target, transformPath) {
  if (!target) {
    res.status(503).json({ success: false, message: "Service not configured" });
    return;
  }

  const forwardedPath = transformPath ? transformPath(req.originalUrl) : req.originalUrl;
  const url = `${target}${forwardedPath}`;
  console.log(`[GATEWAY] [${req.requestId}] -> ${req.method} ${req.originalUrl} -> ${url}`);

  // Multipart/form-data: pipe raw request
  if (req.is("multipart/form-data")) {
    return new Promise((resolve, reject) => {
      const targetUrl = new URL(url);
      const protocol = targetUrl.protocol === "https:" ? https : http;

      const proxyReq = protocol.request(
        targetUrl,
        {
          method: req.method,
          headers: { ...req.headers, host: targetUrl.host, "x-request-id": req.requestId },
          timeout: 30000,
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
          proxyRes.on("end", resolve);
        },
      );

      proxyReq.on("timeout", () => proxyReq.destroy(new Error("Upstream timeout")));
      proxyReq.on("error", (error) => {
        console.error(`[GATEWAY] [${req.requestId}] Proxy error: ${error.message}`);
        if (!res.headersSent) {
          res.status(502).json({ success: false, message: "Service unavailable" });
        }
        reject(error); // triggers circuit breaker
      });

      req.pipe(proxyReq);
    });
  }

  // JSON/form-urlencoded: use axios
  try {
    const response = await axios({
      method: req.method,
      url,
      headers: { ...req.headers, host: new URL(target).host, "x-request-id": req.requestId },
      data: req.body,
      timeout: 30000,
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(`[GATEWAY] [${req.requestId}] Error: ${error.message}`);

    if (error.response && error.response.status < 500) {
      // 4xx: lỗi business hợp lệ, không trigger circuit breaker
      res.status(error.response.status).json(error.response.data);
      return;
    }

    // 5xx hoặc network error: ghi response VÀ throw để circuit breaker ghi nhận
    if (!res.headersSent) {
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(502).json({ success: false, message: "Service unavailable" });
      }
    }
    throw error; // triggers circuit breaker failure count
  }
}

// ── Circuit Breakers (1 per service) ─────────────────────────────────────────
const cbUser    = makeBreaker("user",    USER_SERVICE_URL,    null);
const cbProduct = makeBreaker("product", PRODUCT_SERVICE_URL, (p) => p.replace(/^\/api/, ""));
const cbOrder   = makeBreaker("order",   ORDER_SERVICE_URL,   (p) => p.replace(/^\/api/, ""));
const cbCart    = makeBreaker("cart",    CART_SERVICE_URL,    (p) => p.replace(/^\/api\/cart/, "/cart"));

/*
USER SERVICE
*/
app.use("/api/users", (req, res) => cbUser.fire(req, res));

/*
PRODUCT SERVICE
*/
app.use("/api/products", (req, res) => cbProduct.fire(req, res));

/*
ORDER SERVICE
*/
app.use("/api/orders", (req, res) => cbOrder.fire(req, res));

/*
CART SERVICE
*/
app.use("/api/cart", (req, res) => cbCart.fire(req, res));

/*
VOUCHER SERVICE (inside product service)
*/
app.use("/api/vouchers", (req, res) => cbProduct.fire(req, res));

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
