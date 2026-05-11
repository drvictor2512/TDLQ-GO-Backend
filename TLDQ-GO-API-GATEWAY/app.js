require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const morgan = require("morgan");
const http = require("http");
const https = require("https");

const app = express();
const USER_SERVICE_URL = process.env.USER_SERVICE;
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE;
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE;
const CART_SERVICE_URL = process.env.CART_SERVICE;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Helper function to forward request
async function forwardRequest(req, res, target, transformPath) {
  if (!target) {
    return res.status(503).json({ success: false, message: "Service not configured" });
  }
  try {
    const incomingPath = req.originalUrl;
    const forwardedPath = transformPath ? transformPath(incomingPath) : incomingPath;
    const url = `${target}${forwardedPath}`;
    console.log(`[GATEWAY] -> ${req.method} ${incomingPath} -> ${url}`);

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
          },
          timeout: 30000,
        };

        const proxyReq = protocol.request(targetUrl, options, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
          proxyRes.on("end", resolve);
        });

        proxyReq.on("error", (error) => {
          console.error(`[GATEWAY] Proxy error: ${error.message}`);
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});