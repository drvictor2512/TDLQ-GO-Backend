const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  product_name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
});

const orderSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    seller_id: {
      type: String,
      required: true,
    },
    items: [orderItemSchema],
    total_amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "awaiting_payment",
        "pending",
        "confirmed",
        "preparing",
        "delivering",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },
    shipping_address: {
      type: String,
      required: true,
    },
    receiver_name: {
      type: String,
      required: true,
    },
    phone_number: {
      type: String,
      required: true,
    },
    payment_method: {
      type: String,
      enum: ["COD", "BankTransfer", "VNPay"],
      default: "COD",
    },
    payment_status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    vnpay_txn_ref: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// getOrdersByCustomer: find({ customer_id }).sort({ createdAt: -1 })
orderSchema.index({ customer_id: 1, createdAt: -1 });

// getOrdersBySeller + getSellerStats: find/aggregate({ seller_id, createdAt >= startDate })
orderSchema.index({ seller_id: 1, createdAt: -1 });

// getAdminStats: aggregate({ createdAt >= startDate }) — toàn hệ thống, không lọc seller
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
