const User = require("../models/user.model");
const SellerProfile = require("../models/sellerProfile.model");
const CustomerProfile = require("../models/customerProfile.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.registerUser = async (data) => {
  const { email, password, phone, full_name, role } = data;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const error = new Error("Email already exists");
    error.status = 400;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    email,
    password_hash: hashedPassword,
    phone,
    full_name,
    role,
  });

  if (role === "seller") {
    await SellerProfile.create({
      seller_id: newUser._id,
    });
  } else {
    await CustomerProfile.create({
      user_id: newUser._id,
    });
  }

  return newUser;
};

exports.loginUser = async (email, password) => {
  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error("Invalid email or password");
    error.status = 400;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    const error = new Error("Invalid email or password");
    error.status = 400;
    throw error;
  }

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || "TLDQ_SECRET_KEY",
    { expiresIn: process.env.JWT_EXPIRES_IN },
  );

  return {
    token,
    user: {
      id: user._id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    },
  };
};
