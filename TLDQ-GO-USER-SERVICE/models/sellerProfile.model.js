const mongoose = require("mongoose");

const sellerProfileSchema = new mongoose.Schema({
  seller_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  shop_name: String,
  status: String,
  rating: Number,
  address_line: String,
});

module.exports = mongoose.model("SellerProfile", sellerProfileSchema);
