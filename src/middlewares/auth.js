// src/middlewares/auth.js
const jwt = require("jsonwebtoken");
require("dotenv").config();

/**
 * Middleware xác thực người dùng qua JWT token.
 * ĐẢM BẢO: decoded có đủ _key, name, role
 */
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ msg: "Không có token." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ĐẢM BẢO req.user có name, _key, role
    req.user = {
      _key: decoded._key,
      name: decoded.name?.trim() || "Người dùng ẩn", // fallback an toàn
      email: decoded.email,
      role: decoded.role || "user",
    };

    next();
  } catch (err) {
    console.error("Token error:", err.message);
    return res.status(401).json({ msg: "Token không hợp lệ hoặc đã hết hạn." });
  }
}

/**
 * Middleware chỉ cho phép ADMIN
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ msg: "Bạn không có quyền Admin." });
  }
  next();
}

/**
 * Middleware cho phép ADMIN hoặc MANAGER
 */
function requireManager(req, res, next) {
  if (!req.user || !["admin", "manager"].includes(req.user.role)) {
    return res.status(403).json({ msg: "Bạn không có quyền Quản lý." });
  }
  next();
}

module.exports = { auth, requireAdmin, requireManager };
