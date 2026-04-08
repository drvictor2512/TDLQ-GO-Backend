const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
app.use(cors());
app.use(express.json());
app.get("/", (req, res) => {
  res.send("order service running");
});

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
