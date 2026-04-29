const mongoose = require("mongoose");

const sellerProfileSchema = new mongoose.Schema({
  seller_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  shop_name: {
    type: String,
    required: function() { return this._id != null; }
  },
  description: String,
  address_line: String,
  shop_email: String,
  shop_phone: String,
  logo_url: String,
  banner_url: String,
  operating_hours: String,
  shipping_policy: String,
  return_policy: String,
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
  rating: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model("SellerProfile", sellerProfileSchema);
