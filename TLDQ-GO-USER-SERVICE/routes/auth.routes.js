const express = require("express");
const router = express.Router();
const multer = require("multer");

const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const upload = multer({ storage: multer.memoryStorage() });

// Backward-compatible auth routes
router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", authMiddleware, authController.getProfile);

// User flow
router.post("/user/register", authController.registerUser);
router.post("/user/login", authController.loginUser);
router.post(
  "/user/change-password",
  authMiddleware,
  authMiddleware.requireRoles("customer"),
  authController.changePasswordUser,
);
router.put(
  "/user/profile",
  authMiddleware,
  authMiddleware.requireRoles("customer"),
  upload.single("avatar"),
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
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "logo", maxCount: 1 },
  ]),
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
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
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
