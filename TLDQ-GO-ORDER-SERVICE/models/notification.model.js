const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, default: "order" },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    orderId: { type: String, default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model("Notification", notificationSchema);
