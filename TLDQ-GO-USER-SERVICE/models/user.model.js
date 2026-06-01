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
  reset_password_token: String,
  reset_password_expires: Date,
  seller_upgrade_status: {
    type: String,
    enum: ["none", "pending", "rejected"],
    default: "none",
  },
  seller_upgrade_shop_name: String,
  seller_upgrade_address: String,
  seller_upgrade_requested_at: Date,
  seller_upgrade_reject_reason: String,
});

userSchema.index({ seller_upgrade_status: 1, seller_upgrade_requested_at: -1 });

module.exports = mongoose.model("User", userSchema);
