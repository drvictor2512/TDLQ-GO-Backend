require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const connectDB = require("./config/db");
const productRoutes = require("./routes/product.routes");

const app = express();

connectDB();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/", productRoutes);

app.get("/", (req, res) => {
  res.send("Product service running 🚀");
});

const PORT = process.env.PRODUCT_SERVICE_PORT || 3002;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
