require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cartRoutes = require("./routes/cart.routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/cart", cartRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

const PORT = process.env.CART_SERVICE_PORT || 3004;
app.listen(PORT, () => console.log(`[CartService] running on port ${PORT}`));
