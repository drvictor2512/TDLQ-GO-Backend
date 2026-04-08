const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: String,
  slug: String,
  parent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
  },
  level: Number,
  is_active: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model("Category", categorySchema);
