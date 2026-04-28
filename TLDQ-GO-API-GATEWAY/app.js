require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const morgan = require("morgan");

const app = express();
const USER_SERVICE_URL = process.env.USER_SERVICE;
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE;
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Helper function to forward request
async function forwardRequest(req, res, target) {
  try {
    const url = `${target}${req.originalUrl}`;
    console.log(`[GATEWAY] -> ${req.method} ${req.originalUrl} -> ${url}`);
    
    const config = {
      method: req.method,
      url: url,
      headers: {
        ...req.headers,
        host: new URL(target).host,
      },
      data: req.body,
      timeout: 30000,
    };
    
    const response = await axios(config);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(`[GATEWAY] Error: ${error.message}`);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(502).json({ success: false, message: "Service unavailable" });
    }
  }
}

/*
USER SERVICE - /api/users/* -> http://localhost:3001/api/users/*
*/
app.use("/api/users", (req, res) => forwardRequest(req, res, USER_SERVICE_URL));

/*
PRODUCT SERVICE - /api/products/* -> http://localhost:3002/products/*
*/
app.use("/api/products", (req, res) => forwardRequest(req, res, PRODUCT_SERVICE_URL));

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
app.use("/api/orders", (req, res) => forwardRequest(req, res, ORDER_SERVICE_URL));

/*
TEST GATEWAY
*/
app.get("/", (req, res) => {
  res.send("API Gateway Running");
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
