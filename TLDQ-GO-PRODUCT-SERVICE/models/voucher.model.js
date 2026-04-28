const mongoose = require("mongoose");

const VoucherSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    start_at: { type: Date, required: true },
    end_at: { type: Date, required: true },
    percent: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    applyTo: { type: String, enum: ["all", "specific"], default: "all" },
    product_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Voucher", VoucherSchema);
