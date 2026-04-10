const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password_hash: {
    type: String,
    required: true,
  },
  phone: String,
  full_name: String,
  role: {
    type: String,
    enum: ["customer", "seller", "admin"],
    default: "customer",
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    default: "active",
  },
  avatar_url: String,
});

module.exports = mongoose.model("User", userSchema);
