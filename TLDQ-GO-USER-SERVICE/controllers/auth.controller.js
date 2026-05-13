const User = require("../models/user.model");
const SellerProfile = require("../models/sellerProfile.model");
const CustomerProfile = require("../models/customerProfile.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const emailService = require("../services/email.service");
const cloudinary = require("../config/cloudinary");

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

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getFirstFile(files, fieldName) {
  if (!files || !files[fieldName]) {
    return null;
  }

  return Array.isArray(files[fieldName]) ? files[fieldName][0] : files[fieldName];
}

function uploadBufferToCloudinary(file, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        return resolve(result.secure_url);
      },
    );

    stream.end(file.buffer);
  });
}

async function ensureProfileByRole(userId, role, options = {}) {
  if (role === "seller") {
    const incomingShopName = normalizeText(options.shop_name);
    const incomingAddressLine = normalizeText(options.address_line);

    const sellerProfile = await SellerProfile.findOne({ seller_id: userId });
    if (!sellerProfile) {
      await SellerProfile.create({
        seller_id: userId,
        shop_name: incomingShopName,
        address_line: incomingAddressLine,
      });
    } else {
      let shouldSave = false;

      if (incomingShopName && !sellerProfile.shop_name) {
        sellerProfile.shop_name = incomingShopName;
        shouldSave = true;
      }

      if (incomingAddressLine && !sellerProfile.address_line) {
        sellerProfile.address_line = incomingAddressLine;
        shouldSave = true;
      }

      if (shouldSave) {
        await sellerProfile.save();
      }
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
  const { email, password, phone, full_name, shop_name, address_line } = req.body || {};

  const normalizedEmail = normalizeEmail(email);
  const normalizedFullName = normalizeText(full_name);
  const normalizedShopName = normalizeText(shop_name);
  const normalizedAddressLine = normalizeText(address_line);

  if (!normalizedEmail || !password) {
    return res.status(400).json({ message: "Email và password là bắt buộc" });
  }

  if (!EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ message: "Định dạng email không hợp lệ" });
  }

  if (!validatePassword(password)) {
    return res.status(400).json({ message: "Password phải có ít nhất 6 ký tự" });
  }

  if (!normalizedFullName) {
    return res.status(400).json({ message: "TÃªn hiá»ƒn thá»‹ lÃ  báº¯t buá»™c" });
  }

  if (role === "seller" && !normalizedShopName) {
    return res.status(400).json({ message: "TÃªn cá»­a hÃ ng lÃ  báº¯t buá»™c" });
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
    full_name: normalizedFullName,
    role,
  });

  await ensureProfileByRole(newUser._id, role, {
    shop_name: role === "seller" ? normalizedShopName : "",
    address_line: normalizedAddressLine,
  });

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

    const { phone, full_name, shop_name, address_line } = req.body || {};
    const normalizedFullName = normalizeText(full_name) || normalizeText(user.full_name);
    const normalizedShopName = normalizeText(shop_name);
    const normalizedAddressLine = normalizeText(address_line);

    if (!normalizedFullName) {
      return res.status(400).json({
        message: "Tên hiển thị là bắt buộc",
      });
    }

    if (!normalizedShopName) {
      return res.status(400).json({
        message: "Tên shop là bắt buộc",
      });
    }

    if (typeof phone !== "undefined") user.phone = phone;
    user.full_name = normalizedFullName;

    await ensureProfileByRole(user._id, "seller", {
      shop_name: normalizedShopName,
      address_line: normalizedAddressLine,
    });

    let sellerProfile = await SellerProfile.findOne({ seller_id: user._id });
    if (!sellerProfile) {
      sellerProfile = await SellerProfile.create({ seller_id: user._id });
    }
    sellerProfile.shop_name = normalizedShopName;
    if (normalizedAddressLine) {
      sellerProfile.address_line = normalizedAddressLine;
    }
    await sellerProfile.save();
    user.role = "seller";
    await user.save();

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

    await ensureProfileByRole(newUser._id, role, { shop_name: full_name });

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
    await ensureProfileByRole(user._id, user.role, { shop_name: full_name });

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

    const [customerProfile, sellerProfile] = await Promise.all([
      CustomerProfile.findOne({ user_id: userId }),
      SellerProfile.findOne({ seller_id: userId }),
    ]);

    res.status(200).json({
      user: user.toObject(),
      customerProfile: customerProfile ? customerProfile.toObject() : null,
      sellerProfile: sellerProfile ? sellerProfile.toObject() : null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(200).json({ message: "If email exists, reset link has been sent" });
    }

    const resetToken = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "15m" }
    );

    await User.findByIdAndUpdate(user._id, {
      reset_password_token: resetToken,
      reset_password_expires: new Date(Date.now() + 15 * 60 * 1000)
    });

    try {
      await emailService.sendResetPasswordEmail(user.email, resetToken);
    } catch (emailError) {
      console.error("Email sending failed:", emailError.message);
    }

    return res.status(200).json({ message: "If email exists, reset link has been sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token và mật khẩu mới là bắt buộc" });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ message: "Mật khẩu phải có ít nhất 6 ký tự" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
    } catch (err) {
      return res.status(400).json({ message: "Link đặt lại mật khẩu đã hết hạn hoặc không hợp lệ" });
    }

    const user = await User.findOne({
      _id: decoded.userId,
      reset_password_token: token,
      reset_password_expires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: "Link đặt lại mật khẩu đã hết hạn hoặc không hợp lệ" });
    }

    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.reset_password_token = undefined;
    user.reset_password_expires = undefined;
    await user.save();

    return res.status(200).json({ message: "Đặt lại mật khẩu thành công" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi đặt lại mật khẩu" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    if (req.userRole !== "customer") {
      return res.status(403).json({ message: "Chỉ tài khoản customer mới có thể cập nhật profile bằng endpoint này" });
    }

    const userId = req.userId;
    const { full_name, phone, avatar_url, address_line } = req.body || {};
    const avatarFromFile = req.file ? await uploadBufferToCloudinary(req.file, "avatars") : null;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    if (typeof full_name !== "undefined" && normalizeText(full_name)) user.full_name = normalizeText(full_name);
    if (typeof phone !== "undefined") user.phone = phone;
    if (avatarFromFile) {
      user.avatar_url = avatarFromFile;
    } else if (typeof avatar_url !== "undefined") {
      user.avatar_url = avatar_url;
    }
    await user.save();

    if (typeof address_line !== "undefined") {
      let customerProfile = await CustomerProfile.findOne({ user_id: userId });
      if (!customerProfile) {
        customerProfile = await CustomerProfile.create({ user_id: userId });
      }
      customerProfile.address_line = address_line;
      await customerProfile.save();
    }

    const updatedUser = await User.findById(userId).select("-password_hash");
    const customerProfile = await CustomerProfile.findOne({ user_id: userId });

    return res.status(200).json({
      message: "Cập nhật profile thành công",
      user: updatedUser.toObject(),
      customerProfile: customerProfile ? customerProfile.toObject() : null,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.updateSellerProfile = async (req, res) => {
  try {
    if (req.userRole !== "seller") {
      return res.status(403).json({ message: "Chỉ tài khoản seller mới có thể cập nhật profile bằng endpoint này" });
    }

    const userId = req.userId;
    const { full_name, phone, avatar_url, shop_name, address_line, shop_email, shop_phone } = req.body || {};
    const avatarFromFile = getFirstFile(req.files, "avatar");
    const logoFromFile = getFirstFile(req.files, "logo");
    const avatarUrlFromFile = avatarFromFile ? await uploadBufferToCloudinary(avatarFromFile, "avatars") : null;
    const logoUrlFromFile = logoFromFile ? await uploadBufferToCloudinary(logoFromFile, "shop-logos") : null;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Seller không tồn tại" });
    }

    if (typeof full_name !== "undefined" && normalizeText(full_name)) user.full_name = normalizeText(full_name);
    if (typeof phone !== "undefined") user.phone = phone;
    if (avatarUrlFromFile) {
      user.avatar_url = avatarUrlFromFile;
    } else if (typeof avatar_url !== "undefined") {
      user.avatar_url = avatar_url;
    }
    await user.save();

    let sellerProfile = await SellerProfile.findOne({ seller_id: userId });
    if (!sellerProfile) {
      sellerProfile = await SellerProfile.create({ seller_id: userId });
    }

    if (typeof shop_name !== "undefined" && normalizeText(shop_name)) sellerProfile.shop_name = normalizeText(shop_name);
    if (typeof address_line !== "undefined") sellerProfile.address_line = address_line;
    if (typeof shop_email !== "undefined") sellerProfile.shop_email = shop_email;
    if (typeof shop_phone !== "undefined") sellerProfile.shop_phone = shop_phone;
    if (logoUrlFromFile) {
      sellerProfile.logo_url = logoUrlFromFile;
    }
    await sellerProfile.save();

    const updatedUser = await User.findById(userId).select("-password_hash");

    return res.status(200).json({
      message: "Cập nhật profile seller thành công",
      user: updatedUser.toObject(),
      sellerProfile: sellerProfile.toObject(),
    });
  } catch (error) {
    console.error("Update seller profile error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword và newPassword là bắt buộc" });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ message: "Mật khẩu mới phải có ít nhất 6 ký tự" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    if (userRole === "seller" && user.role !== "seller") {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (userRole === "customer" && user.role !== "customer") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Mật khẩu hiện tại không đúng" });
    }

    user.password_hash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({ message: "Đổi mật khẩu thành công" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getShopSetupStatus = async (req, res) => {
  try {
    if (req.userRole !== "seller") {
      return res.status(403).json({ message: "Chỉ tài khoản seller mới có quyền truy cập" });
    }

    const userId = req.userId;
    const sellerProfile = await SellerProfile.findOne({ seller_id: userId });

    const isSetupComplete = sellerProfile
      && sellerProfile.shop_name
      && sellerProfile.shop_name.trim() !== "";

    return res.status(200).json({
      isSetupComplete,
      profile: sellerProfile ? sellerProfile.toObject() : null,
    });
  } catch (error) {
    console.error("Get shop setup status error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.updateShopSettings = async (req, res) => {
  try {
    if (req.userRole !== "seller") {
      return res.status(403).json({ message: "Chỉ tài khoản seller mới có quyền truy cập" });
    }

    const userId = req.userId;
    const {
      shop_name,
      description,
      address_line,
      shop_email,
      shop_phone,
      logo_url,
      banner_url,
      operating_hours,
      shipping_policy,
      return_policy,
      status,
    } = req.body || {};
    const logoFromFile = getFirstFile(req.files, "logo");
    const bannerFromFile = getFirstFile(req.files, "banner");
    const logoUrlFromFile = logoFromFile ? await uploadBufferToCloudinary(logoFromFile, "shop-logos") : null;
    const bannerUrlFromFile = bannerFromFile ? await uploadBufferToCloudinary(bannerFromFile, "shop-banners") : null;

    if (!shop_name || !shop_name.trim()) {
      return res.status(400).json({ message: "Tên cửa hàng là bắt buộc" });
    }

    if (!address_line || !address_line.trim()) {
      return res.status(400).json({ message: "Địa chỉ cửa hàng là bắt buộc" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Seller không tồn tại" });
    }

    let sellerProfile = await SellerProfile.findOne({ seller_id: userId });
    if (!sellerProfile) {
      sellerProfile = new SellerProfile({ seller_id: userId });
    }

    if (typeof shop_name !== "undefined") sellerProfile.shop_name = shop_name;
    if (typeof description !== "undefined") sellerProfile.description = description;
    if (typeof address_line !== "undefined") sellerProfile.address_line = address_line;
    if (typeof shop_email !== "undefined") sellerProfile.shop_email = shop_email;
    if (typeof shop_phone !== "undefined") sellerProfile.shop_phone = shop_phone;
    if (logoUrlFromFile) {
      sellerProfile.logo_url = logoUrlFromFile;
    } else if (typeof logo_url !== "undefined") {
      sellerProfile.logo_url = logo_url;
    }
    if (bannerUrlFromFile) {
      sellerProfile.banner_url = bannerUrlFromFile;
    } else if (typeof banner_url !== "undefined") {
      sellerProfile.banner_url = banner_url;
    }
    if (typeof operating_hours !== "undefined") sellerProfile.operating_hours = operating_hours;
    if (typeof shipping_policy !== "undefined") sellerProfile.shipping_policy = shipping_policy;
    if (typeof return_policy !== "undefined") sellerProfile.return_policy = return_policy;
    if (typeof status !== "undefined") sellerProfile.status = status;

    await sellerProfile.save();

    return res.status(200).json({
      message: "Cập nhật cài đặt cửa hàng thành công",
      profile: sellerProfile.toObject(),
    });
  } catch (error) {
    console.error("Update shop settings error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getSellerPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const [sellerProfile, user] = await Promise.all([
      SellerProfile.findOne({ seller_id: id }),
      User.findById(id).select("full_name avatar_url role"),
    ]);

    if (!sellerProfile) {
      return res.status(200).json({
        data: { shop_name: "Nhà bán", logo_url: null, description: "", rating: 0 },
      });
    }

    const data = sellerProfile.toObject();
    return res.status(200).json({
      data: {
        ...data,
        shop_name: data.shop_name || user?.full_name || "Nhà bán",
        logo_url: data.logo_url || user?.avatar_url || null,
        owner_name: user?.full_name || "",
        owner_avatar_url: user?.avatar_url || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
