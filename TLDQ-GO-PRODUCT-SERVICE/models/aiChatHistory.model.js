const mongoose = require("mongoose");

const aiChatHistorySchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
    },
    question: {
      type: String,
      required: true,
    },
    answer: {
      type: String,
      required: true,
    },
    products: {
      type: [
        {
          product_id: String,
          name: String,
          price: Number,
          rating_average: Number,
          sold: Number,
          category: String,
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AiChatHistory", aiChatHistorySchema);
