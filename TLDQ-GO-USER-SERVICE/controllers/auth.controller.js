const User = require("../models/user.model");
const CustomerProfile = require("../models/customerProfile.model");
const SellerProfile = require("../models/sellerProfile.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const USER_ROLES = ["customer", "seller", "admin"];

const omitPassword = (user) => {
  const userObj = user.toObject();
  delete userObj.password_hash;
  return userObj;
};

const createAccessToken = (user) => {
  return jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "7d" }
  );
};

const validatePassword = (password) => {
  return typeof password === "string" && password.length >= 6;
};

async function ensureProfileByRole(userId, role, options = {}) {
  if (role === "seller") {
    const incomingShopName = typeof options.shop_name === "string" ? options.shop_name.trim() : "";
    const incomingAddressLine = typeof options.address_line === "string" ? options.address_line.trim() : "";

    const sellerProfile = await SellerProfile.findOne({ seller_id: userId });
    if (!sellerProfile) {
      await SellerProfile.create({
        seller_id: userId,
        shop_name: incomingShopName,
        address_line: incomingAddressLine,
      });
    } else {
      let changed = false;
      if (incomingShopName && !sellerProfile.shop_name) {
        sellerProfile.shop_name = incomingShopName;
        changed = true;
      }
      if (incomingAddressLine && !sellerProfile.address_line) {
        sellerProfile.address_line = incomingAddressLine;
        changed = true;
      }
      if (changed) await sellerProfile.save();
    }
    return;
  }

  if (role === "customer") {
    const customerProfile = await CustomerProfile.findOne({ user_id: userId });
    if (!customerProfile) {
      await CustomerProfile.create({ user_id: userId });
    }
    return;
  }
}

async function loginByRole(req, res, allowedRoles) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email và password là bắt buộc" });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !allowedRoles.includes(user.role)) {
    return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
  }

  const populatedUser = await User.findById(user._id)
    .select("-password_hash")
    .populate("customerProfile")
    .populate("sellerProfile");

  const token = createAccessToken(user);
  return res.status(200).json({
    message: "Đăng nhập thành công",
    token,
    user: populatedUser,
  });
}

exports.registerUser = async (req, res) => {
  try {
    const { email, password, full_name, role = "customer" } = req.body || {};
    if (!email || !password || !full_name) {
      return res.status(400).json({ message: "Vui lòng điền đủ email, password, full_name" });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ message: "Mật khẩu phải từ 6 ký tự" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ message: "Email đã tồn tại" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      email: email.toLowerCase().trim(),
      password_hash: hashedPassword,
      full_name,
      role,
    });

    const { address_line } = req.body || {};
    await ensureProfileByRole(newUser._id, role, { 
      shop_name: full_name,
      address_line: address_line
    });

    const token = createAccessToken(newUser);
    return res.status(201).json({ message: "Đăng ký thành công", token, user: omitPassword(newUser) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    return await loginByRole(req, res, ["customer", "seller"]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.changePasswordUser = async (req, res) => {
  try {
    if (req.userRole !== "customer" && req.userRole !== "seller") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword và newPassword là bắt buộc" });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ message: "newPassword phải có ít nhất 6 ký tự" });
    }

    const user = await User.findById(req.userId);
    if (!user || (user.role !== "customer" && user.role !== "seller")) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Mật khẩu hiện tại không đúng" });
    }

    user.password_hash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ message: "Đổi mật khẩu thành công" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.registerSeller = async (req, res) => {
  try {
    const { email, password, full_name, shop_name, phone, address_line } = req.body || {};
    if (!email || !password || !shop_name) {
      return res.status(400).json({ message: "Email, password, shop_name là bắt buộc" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ message: "Email đã tồn tại" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      email: email.toLowerCase().trim(),
      password_hash: hashedPassword,
      full_name: full_name || shop_name,
      phone,
      role: "seller",
    });

    await ensureProfileByRole(newUser._id, "seller", { 
      shop_name: shop_name || full_name,
      address_line: address_line 
    });

    const token = createAccessToken(newUser);
    return res.status(201).json({ message: "Đăng ký seller thành công", token, user: omitPassword(newUser) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.loginSeller = async (req, res) => {
  try {
    return await loginByRole(req, res, ["seller"]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.upgradeSeller = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    if (user.role === "seller") {
      const token = createAccessToken(user);
      return res.status(200).json({
        message: "Tài khoản đã là seller",
        token,
        user: omitPassword(user),
      });
    }

    const { phone, full_name, shop_name, address_line } = req.body || {};
    const normalizedShopName = (shop_name || full_name || "").trim();

    if (!normalizedShopName) {
      return res.status(400).json({
        message: "Tên shop là bắt buộc",
      });
    }

    if (typeof phone !== "undefined") user.phone = phone;
    if (typeof full_name !== "undefined" && full_name) user.full_name = full_name;

    await ensureProfileByRole(user._id, "seller", { 
      shop_name: normalizedShopName,
      address_line: address_line 
    });
    user.role = "seller";
    await user.save();

    const token = createAccessToken(user);
    return res.status(200).json({
      message: "Nâng cấp lên seller thành công",
      token,
      user: omitPassword(user),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

async function registerByRole(req, res, role) {
  try {
    const { email, password, phone, full_name, shop_name, address_line } = req.body || {};
    const normalizedEmail = (email || "").toLowerCase().trim();
    const normalizedShopName = (shop_name || full_name || "").trim();

    if (!normalizedEmail || !password || !normalizedShopName) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
    }

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ message: "Email đã tồn tại" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      email: normalizedEmail,
      password_hash: hashedPassword,
      phone,
      full_name: full_name || normalizedShopName,
      role,
      status: "active",
    });

    await ensureProfileByRole(newUser._id, role, { shop_name: normalizedShopName, address_line: address_line });

    return res.status(201).json({ message: "Tạo user thành công", user: omitPassword(newUser) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const role = req.query.role;
    const status = req.query.status;
    const keyword = (req.query.keyword || "").trim();

    const filter = {};

    if (role && USER_ROLES.includes(role)) filter.role = role;
    if (status) filter.status = status;
    if (keyword) {
      filter.$or = [
        { email: { $regex: keyword, $options: "i" } },
        { full_name: { $regex: keyword, $options: "i" } },
        { phone: { $regex: keyword, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .select("-password_hash")
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password_hash")
      .populate("customerProfile")
      .populate("sellerProfile");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createUser = (req, res) => registerByRole(req, res, req.body.role || "customer");

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone, status, role } = req.body || {};

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (typeof full_name !== "undefined") user.full_name = full_name;
    if (typeof phone !== "undefined") user.phone = phone;
    if (typeof status !== "undefined") user.status = status;
    if (typeof role !== "undefined" && USER_ROLES.includes(role)) user.role = role;

    await user.save();
    await ensureProfileByRole(user._id, user.role, { shop_name: full_name });

    return res.status(200).json({ message: "Cập nhật user thành công", user: omitPassword(user) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ message: "Xóa user thành công" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId)
      .select("-password_hash")
      .populate("customerProfile")
      .populate("sellerProfile");
    if (!user) return res.status(404).json({ message: "Người dùng không tồn tại" });

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    if (req.userRole !== "customer" && req.userRole !== "seller") {
      return res.status(403).json({ message: "Chỉ tài khoản customer/seller mới có thể cập nhật profile bằng endpoint này" });
    }

    const userId = req.userId;
    const { full_name, phone, avatar_url, address_line } = req.body || {};

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    if (typeof full_name !== "undefined") user.full_name = full_name;
    if (typeof phone !== "undefined") user.phone = phone;
    if (typeof avatar_url !== "undefined") user.avatar_url = avatar_url;
    await user.save();

    if (typeof address_line !== "undefined") {
      let customerProfile = await CustomerProfile.findOne({ user_id: userId });
      if (!customerProfile) {
        customerProfile = await CustomerProfile.create({ user_id: userId });
      }
      customerProfile.address_line = address_line;
      await customerProfile.save();
    }

    const updatedUser = await User.findById(userId)
      .select("-password_hash")
      .populate("customerProfile")
      .populate("sellerProfile");

    return res.status(200).json({
      message: "Cập nhật profile thành công",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getSellerPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerProfile = await SellerProfile.findOne({ seller_id: id });

    if (!sellerProfile) {
      return res.status(200).json({
        data: { shop_name: "Nhà bán", logo_url: null, description: "", rating: 0 },
      });
    }

    return res.status(200).json({ data: sellerProfile.toObject() });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Vui lòng chọn ảnh để upload" });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    await User.findByIdAndUpdate(req.userId, { avatar_url: avatarUrl });

    return res.status(200).json({
      message: "Upload ảnh đại diện thành công",
      avatar_url: avatarUrl,
    });
  } catch (error) {
    console.error("Upload avatar error:", error);
    res.status(500).json({ message: error.message });
  }
};
