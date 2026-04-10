const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");

console.log(authController);

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/:id", authController.getUserById);
router.put("/:id", authController.updateUser);

module.exports = router;
