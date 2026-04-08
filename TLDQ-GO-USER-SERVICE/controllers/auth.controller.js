const User = require("../models/user.model");
const SellerProfile = require("../models/sellerProfile.model");
const CustomerProfile = require("../models/customerProfile.model");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
  try {
    const { email, password, phone, full_name, role } = req.body;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      email,
      password_hash: hashedPassword,
      phone,
      full_name,
      role,
    });

    // create profile
    if (role === "seller") {
      await SellerProfile.create({
        seller_id: newUser._id,
      });
    } else {
      await CustomerProfile.create({
        user_id: newUser._id,
      });
    }

    res.status(201).json({
      message: "Register success",
      user: newUser,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const secret = process.env.USER_SERVICE_JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: "JWT secret not configured" });
    }

    const payload = { sub: user._id, email: user.email, role: user.role };
    const token = jwt.sign(payload, secret, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

    const safeUser = user.toObject();
    delete safeUser.password_hash;

    res.json({ message: "Login success", token, user: safeUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
