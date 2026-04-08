const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.USER_SERVICE_MONGO_URI, {
      dbName: process.env.USER_DB_NAME,
    });

    console.log("MongoDB connected");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

module.exports = connectDB;
