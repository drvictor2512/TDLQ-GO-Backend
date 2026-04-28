const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.USER_SERVICE_MONGO_URI || process.env.MONGO_URL;
    const dbName = process.env.USER_DB_NAME || process.env.USER_SERVICE_DB_NAME || process.env.DB_NAME;

    if (!uri) {
      console.error('MongoDB URI is not set. Please set MONGO_URI or USER_SERVICE_MONGO_URI in environment');
      process.exit(1);
    }

    await mongoose.connect(uri, {
      dbName,
    });
    console.log("MongoDB connected");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

module.exports = connectDB;
