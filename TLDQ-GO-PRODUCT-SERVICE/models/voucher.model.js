const mongoose = require("mongoose");

const voucherSchema = new mongoose.Schema(
  {
    seller_id: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    start_date: {
      type: Date,
      required: true,
    },
    end_date: {
      type: Date,
      required: true,
    },
    discount_percent: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    apply_scope: {
      type: String,
      enum: ["all", "specific"],
      required: true,
    },
    product_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Voucher", voucherSchema);
