const mongoose = require("mongoose");

const customerProfileSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  dateOfBirth: Date,
  address_line: String,
});

module.exports = mongoose.model("CustomerProfile", customerProfileSchema);
