const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const authMiddleware = async function (req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    // optionally attach user object
    try {
      const user = await User.findById(req.userId).select("-password_hash");
      if (user) req.user = user;
    } catch (e) {
      // ignore user attach errors
    }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

authMiddleware.requireRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
};

module.exports = authMiddleware;
