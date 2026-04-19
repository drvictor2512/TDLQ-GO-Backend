const cloudinary = require("cloudinary").v2;

// Cấu hình Cloudinary với thông tin từ tài khoản của bạn
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

module.exports = cloudinary;
