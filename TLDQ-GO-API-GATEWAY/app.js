require("dotenv").config();

const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cors = require("cors");
const morgan = require("morgan");

const app = express();
const USER_SERVICE_URL = process.env.USER_SERVICE;
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE;
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const proxyOptions = (target, rewritePrefix) => ({
  timeout: 30000,
  proxyTimeout: 30000,
  target,
  changeOrigin: true,
  pathRewrite: (path) => `${rewritePrefix}${path}`,
  on: {
    error: (err, req, res) => {
      console.error(`[GATEWAY] Proxy error: ${err.message}`);
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          message: "Service temporarily unavailable. Please try again later.",
          error: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
      }
    },
    proxyReq: (proxyReq, req) => {
      console.log(`[GATEWAY] -> ${req.method} ${req.originalUrl} -> ${target}`);
      proxyReq.setHeader("X-Forwarded-For", req.ip);
      proxyReq.setHeader("X-Gateway-Request", "true");

      if (req.body && Object.keys(req.body).length) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader("Content-Type", "application/json");
        proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
        try {
          proxyReq.write(bodyData);
        } catch (writeErr) {
          console.error(`[GATEWAY] Failed to write proxied body: ${writeErr.message}`);
        }
      }
    },
    proxyRes: (proxyRes, req) => {
      console.log(`[GATEWAY] <- ${proxyRes.statusCode} ${req.originalUrl}`);
    },
  },
});

/*
USER SERVICE
*/
app.use(
  "/api/users",
  createProxyMiddleware(proxyOptions(USER_SERVICE_URL, "/users")),
);

/*
PRODUCT SERVICE
*/
app.use(
  "/api/products",
  createProxyMiddleware(proxyOptions(PRODUCT_SERVICE_URL, "/products")),
);

/*
VOUCHER (proxy to product service)
*/
app.use(
  "/api/vouchers",
  createProxyMiddleware(proxyOptions(PRODUCT_SERVICE_URL, "/vouchers")),
);

/*
ORDER SERVICE
*/
app.use(
  "/api/orders",
  createProxyMiddleware(proxyOptions(ORDER_SERVICE_URL, "/orders")),
);

/*
TEST GATEWAY
*/
app.get("/", (req, res) => {
  res.send("API Gateway Running 🚀");
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

const PORT = process.env.API_GATEWAY_PORT || 3000;

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
