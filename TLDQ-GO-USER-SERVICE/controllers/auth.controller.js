const User = require("../models/user.model");
const SellerProfile = require("../models/sellerProfile.model");
const CustomerProfile = require("../models/customerProfile.model");

const bcrypt = require("bcryptjs");

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
