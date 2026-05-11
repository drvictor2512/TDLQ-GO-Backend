const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "uploads/";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "avatar-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Backward-compatible auth routes
router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", authMiddleware, authController.getProfile);
router.post("/upload-avatar", authMiddleware, upload.single("avatar"), authController.uploadAvatar);

// User flow
router.post("/user/register", authController.registerUser);
router.post("/user/login", authController.loginUser);
router.post(
  "/user/change-password",
  authMiddleware,
  authMiddleware.requireRoles("customer", "seller"),
  authController.changePasswordUser,
);
router.put(
  "/user/profile",
  authMiddleware,
  authMiddleware.requireRoles("customer", "seller"),
  authController.updateProfile,
);

// Seller flow
router.post("/seller/register", authController.registerSeller);
router.post(
  "/seller/upgrade",
  authMiddleware,
  authMiddleware.requireRoles("customer"),
  authController.upgradeSeller,
);
router.post("/seller/login", authController.loginSeller);
router.post(
  "/seller/change-password",
  authMiddleware,
  authMiddleware.requireRoles("seller"),
  authController.changePasswordSeller,
);
router.put(
  "/seller/profile",
  authMiddleware,
  authMiddleware.requireRoles("seller"),
  authController.updateSellerProfile,
);

// Seller Shop Settings
router.get(
  "/seller/setup-status",
  authMiddleware,
  authMiddleware.requireRoles("seller"),
  authController.getShopSetupStatus,
);
router.put(
  "/seller/settings",
  authMiddleware,
  authMiddleware.requireRoles("seller"),
  authController.updateShopSettings,
);

// Forgot & Reset Password
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

// Change Password (generic - works for both customer and seller)
router.post(
  "/change-password",
  authMiddleware,
  authController.changePassword,
);

// Admin flow
router.post("/admin/login", authController.loginAdmin);
router.get(
  "/admin/users",
  authMiddleware,
  authMiddleware.requireRoles("admin"),
  authController.adminListUsers,
);
router.get(
  "/admin/users/:id",
  authMiddleware,
  authMiddleware.requireRoles("admin"),
  authController.adminGetUserById,
);
router.post(
  "/admin/users",
  authMiddleware,
  authMiddleware.requireRoles("admin"),
  authController.adminCreateUser,
);
router.put(
  "/admin/users/:id",
  authMiddleware,
  authMiddleware.requireRoles("admin"),
  authController.adminUpdateUser,
);
router.delete(
  "/admin/users/:id",
  authMiddleware,
  authMiddleware.requireRoles("admin"),
  authController.adminDeleteUser,
);

// Public seller profile — must be before /:id to avoid Express matching "seller" as an id
router.get("/seller/:id/profile", authController.getSellerPublicProfile);

// Internal route for fetching user info (used by Order Service)
router.get("/:id", authController.adminGetUserById);

module.exports = router;
