const mongoose = require("mongoose");

const flashSaleSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    seller_id: { type: String, required: true },
    original_price: { type: Number, required: true },
    sale_price: { type: Number, required: true },
    discount_percent: { type: Number, default: 0 },
    start_time: { type: Date, required: true },
    end_time: { type: Date, required: true },
    quantity_limit: { type: Number, default: 0 },
    quantity_sold: { type: Number, default: 0 },
    status: { type: String, enum: ["upcoming", "active", "ended"], default: "upcoming" },
  },
  { timestamps: true }
);

flashSaleSchema.index({ product_id: 1 });
flashSaleSchema.index({ status: 1 });
flashSaleSchema.index({ seller_id: 1 });
flashSaleSchema.index({ end_time: 1 });

module.exports = mongoose.model("FlashSale", flashSaleSchema);
