const authService = require("../services/auth.service");
const User = require("../models/user.model");

exports.register = async (req, res) => {
  try {
    const newUser = await authService.registerUser(req.body);
    res.status(201).json({
      message: "Register success",
      user: newUser,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);

    res.status(200).json({
      message: "Login success",
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message,
    });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password_hash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ message: "Success", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { full_name, phone, role, avatar_url, email } = req.body;

    const updateData = { full_name, phone, role, avatar_url };
    if (email) {
      updateData.email = email;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true },
    ).select("-password_hash");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Update success",
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
