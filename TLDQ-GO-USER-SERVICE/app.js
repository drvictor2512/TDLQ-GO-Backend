require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth.routes");

const app = express();

connectDB();

app.use(cors());

// Static serving for uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(express.json());
app.use(morgan("dev"));

app.use("/api/users", authRoutes);

app.get("/", (req, res) => {
  res.send("User service running22");
});

const PORT = process.env.USER_SERVICE_PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
