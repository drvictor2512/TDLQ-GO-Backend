const User = require("../models/user.model");
const SellerProfile = require("../models/sellerProfile.model");
const CustomerProfile = require("../models/customerProfile.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const USER_ROLES = ["customer", "seller", "admin"];

function omitPassword(userDoc) {
  const user = userDoc.toObject ? userDoc.toObject() : userDoc;
  if (user.password_hash) delete user.password_hash;
  return user;
}

function normalizeEmail(email) {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

function createAccessToken(user) {
  return jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET || "secretkey",
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 6;
}

async function ensureProfileByRole(userId, role) {
  if (role === "seller") {
    const sellerProfile = await SellerProfile.findOne({ seller_id: userId });
    if (!sellerProfile) {
      await SellerProfile.create({ seller_id: userId });
    }
    return;
  }

  if (role === "customer") {
    const customerProfile = await CustomerProfile.findOne({ user_id: userId });
    if (!customerProfile) {
      await CustomerProfile.create({ user_id: userId });
    }
  }
}

async function registerByRole(req, res, role) {
  const { email, password, phone, full_name } = req.body || {};

  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return res.status(400).json({ message: "Email và password là bắt buộc" });
  }

  if (!EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ message: "Định dạng email không hợp lệ" });
  }

  if (!validatePassword(password)) {
    return res.status(400).json({ message: "Password phải có ít nhất 6 ký tự" });
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(409).json({ message: "Email đã tồn tại" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    email: normalizedEmail,
    password_hash: hashedPassword,
    phone,
    full_name,
    role,
  });

  await ensureProfileByRole(newUser._id, role);

  const token = createAccessToken(newUser);
  return res.status(201).json({ message: "Đăng ký thành công", token, user: omitPassword(newUser) });
}

async function loginByRole(req, res, acceptedRoles) {
  const { email, password } = req.body || {};

  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return res.status(400).json({ message: "Email và password là bắt buộc" });
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return res.status(400).json({ message: "Email hoặc password không đúng" });
  }

  if (Array.isArray(acceptedRoles) && acceptedRoles.length > 0 && !acceptedRoles.includes(user.role)) {
    return res.status(403).json({ message: "Không có quyền truy cập" });
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return res.status(400).json({ message: "Email hoặc password không đúng" });
  }

  const token = createAccessToken(user);
  return res.status(200).json({ message: "Đăng nhập thành công", token, user: omitPassword(user) });
}

exports.register = async (req, res) => {
  try {
    const role = req.body?.role;
    const safeRole = role === "seller" ? "seller" : "customer";
    return await registerByRole(req, res, safeRole);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    return await loginByRole(req, res, null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.registerUser = async (req, res) => {
  try {
    return await registerByRole(req, res, "customer");
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    return await loginByRole(req, res, ["customer"]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.changePasswordUser = async (req, res) => {
  try {
    if (req.userRole !== "customer") {
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
    if (!user || user.role !== "customer") {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Mật khẩu hiện tại không đúng" });
    }

    user.password_hash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({ message: "Đổi mật khẩu thành công" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.registerSeller = async (req, res) => {
  try {
    return await registerByRole(req, res, "seller");
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.upgradeSeller = async (req, res) => {
  try {
    if (req.userRole !== "customer") {
      return res.status(403).json({
        message: "Chỉ tài khoản customer mới có thể nâng cấp lên seller",
      });
    }

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

    const { phone, full_name } = req.body || {};

    user.role = "seller";
    if (typeof phone !== "undefined") user.phone = phone;
    if (typeof full_name !== "undefined") user.full_name = full_name;

    await user.save();
    await ensureProfileByRole(user._id, "seller");

    const token = createAccessToken(user);
    return res.status(200).json({
      message: "Nâng cấp tài khoản seller thành công",
      token,
      user: omitPassword(user),
    });
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

exports.changePasswordSeller = async (req, res) => {
  try {
    if (req.userRole !== "seller") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword và newPassword là bắt buộc" });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ message: "newPassword phải có ít nhất 6 ký tự" });
    }

    const seller = await User.findById(req.userId);
    if (!seller || seller.role !== "seller") {
      return res.status(404).json({ message: "Seller không tồn tại" });
    }

    const isMatch = await bcrypt.compare(currentPassword, seller.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Mật khẩu hiện tại không đúng" });
    }

    seller.password_hash = await bcrypt.hash(newPassword, 10);
    await seller.save();

    return res.status(200).json({ message: "Đổi mật khẩu seller thành công" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.loginAdmin = async (req, res) => {
  try {
    return await loginByRole(req, res, ["admin"]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.adminListUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);

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

exports.adminGetUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password_hash");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }
    return res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.adminCreateUser = async (req, res) => {
  try {
    const { email, password, phone, full_name, role = "customer", status, avatar_url } = req.body || {};

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: "Email và password là bắt buộc" });
    }

    if (!EMAIL_RE.test(normalizedEmail)) {
      return res.status(400).json({ message: "Định dạng email không hợp lệ" });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ message: "Password phải có ít nhất 6 ký tự" });
    }

    if (!USER_ROLES.includes(role)) {
      return res.status(400).json({ message: "role không hợp lệ" });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "Email đã tồn tại" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      email: normalizedEmail,
      password_hash: hashedPassword,
      phone,
      full_name,
      role,
      status,
      avatar_url,
    });

    await ensureProfileByRole(newUser._id, role);

    return res.status(201).json({ message: "Tạo user thành công", user: omitPassword(newUser) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.adminUpdateUser = async (req, res) => {
  try {
    const { phone, full_name, role, status, avatar_url, password } = req.body || {};

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    if (role && !USER_ROLES.includes(role)) {
      return res.status(400).json({ message: "role không hợp lệ" });
    }

    if (typeof phone !== "undefined") user.phone = phone;
    if (typeof full_name !== "undefined") user.full_name = full_name;
    if (typeof role !== "undefined") user.role = role;
    if (typeof status !== "undefined") user.status = status;
    if (typeof avatar_url !== "undefined") user.avatar_url = avatar_url;

    if (typeof password !== "undefined") {
      if (!validatePassword(password)) {
        return res.status(400).json({ message: "Password phải có ít nhất 6 ký tự" });
      }
      user.password_hash = await bcrypt.hash(password, 10);
    }

    await user.save();
    await ensureProfileByRole(user._id, user.role);

    return res.status(200).json({ message: "Cập nhật user thành công", user: omitPassword(user) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.adminDeleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    await Promise.all([
      User.deleteOne({ _id: user._id }),
      SellerProfile.deleteMany({ seller_id: user._id }),
      CustomerProfile.deleteMany({ user_id: user._id }),
    ]);

    return res.status(200).json({ message: "Xóa user thành công" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId).select("-password_hash");
    if (!user) return res.status(404).json({ message: "Người dùng không tồn tại" });

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
