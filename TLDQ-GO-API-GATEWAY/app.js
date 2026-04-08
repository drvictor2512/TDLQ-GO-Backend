require("dotenv").config();

const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cors = require("cors");
const morgan = require("morgan");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

/*
USER SERVICE
*/
app.use(
  "/api/users",
  createProxyMiddleware({
    target: process.env.USER_SERVICE,
    changeOrigin: true,
    pathRewrite: {
      "^/api/users": "/users",
    },
  }),
);

/*
PRODUCT SERVICE
*/
app.use(
  "/api/products",
  createProxyMiddleware({
    target: process.env.PRODUCT_SERVICE,
    changeOrigin: true,
    pathRewrite: {
      "^/api/products": "/products",
    },
  }),
);

/*
ORDER SERVICE
*/
app.use(
  "/api/orders",
  createProxyMiddleware({
    target: process.env.ORDER_SERVICE,
    changeOrigin: true,
    pathRewrite: {
      "^/api/orders": "/orders",
    },
  }),
);

/*
TEST GATEWAY
*/
app.get("/", (req, res) => {
  res.send("API Gateway Running 🚀");
});

const PORT = process.env.API_GATEWAY_PORT || 3000;

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
