const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.PRODUCT_SERVICE_MONGO_URI, {
      dbName: process.env.PRODUCT_DB_NAME,
    });
    console.log("MongoDB connected 🚀");
  } catch (error) {
    console.error("MongoDB error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
