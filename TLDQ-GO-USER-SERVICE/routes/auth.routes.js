const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");

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
	authController.changePasswordUser
);

// Seller flow
router.post("/seller/register", authController.registerSeller);
router.post("/seller/login", authController.loginSeller);
router.post(
	"/seller/change-password",
	authMiddleware,
	authMiddleware.requireRoles("seller"),
	authController.changePasswordSeller
);

// Admin flow
router.post("/admin/login", authController.loginAdmin);
router.get("/admin/users", authMiddleware, authMiddleware.requireRoles("admin"), authController.adminListUsers);
router.get("/admin/users/:id", authMiddleware, authMiddleware.requireRoles("admin"), authController.adminGetUserById);
router.post("/admin/users", authMiddleware, authMiddleware.requireRoles("admin"), authController.adminCreateUser);
router.put("/admin/users/:id", authMiddleware, authMiddleware.requireRoles("admin"), authController.adminUpdateUser);
router.delete("/admin/users/:id", authMiddleware, authMiddleware.requireRoles("admin"), authController.adminDeleteUser);

module.exports = router;
