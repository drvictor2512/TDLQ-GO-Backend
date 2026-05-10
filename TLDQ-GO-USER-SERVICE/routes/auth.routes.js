const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../../../TLDQ-GO-KTPM-WEB/public/uploads");
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
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ cho phép upload file ảnh!"), false);
    }
  }
});

// USER ROUTES
router.post("/register", authController.registerUser);
router.post("/login", authController.loginUser);
router.post(
  "/change-password",
  authMiddleware,
  authController.changePasswordUser
);
router.get("/profile", authMiddleware, authController.getProfile);
router.put(
  "/profile",
  authMiddleware,
  authController.updateProfile
);

router.post(
  "/upload-avatar",
  authMiddleware,
  upload.single("avatar"),
  authController.uploadAvatar
);

// SELLER ROUTES
router.post("/seller/register", authController.registerSeller);
router.post("/seller/login", authController.loginSeller);
router.post(
  "/seller/upgrade",
  authMiddleware,
  authController.upgradeSeller
);
router.get("/seller/public/:id", authController.getSellerPublicProfile);

// ADMIN ROUTES
router.get(
  "/",
  authMiddleware,
  authMiddleware.requireRoles(["admin"]),
  authController.getUsers
);
router.get(
  "/:id",
  authMiddleware,
  authMiddleware.requireRoles(["admin"]),
  authController.getUserById
);
router.post(
  "/",
  authMiddleware,
  authMiddleware.requireRoles(["admin"]),
  authController.createUser
);
router.put(
  "/:id",
  authMiddleware,
  authMiddleware.requireRoles(["admin"]),
  authController.updateUser
);
router.delete(
  "/:id",
  authMiddleware,
  authMiddleware.requireRoles(["admin"]),
  authController.deleteUser
);

module.exports = router;
