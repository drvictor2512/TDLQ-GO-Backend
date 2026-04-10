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
      enum: ["COD", "BankTransfer"],
      default: "COD",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", orderSchema);
