// src/routes/auth.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const jwt = require("jsonwebtoken");

const Users = db.collection("Users");

// Đăng ký
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ msg: "Thiếu thông tin (name, email, password)" });
    }

    // Kiểm tra email trùng
    const cursor = await db.query(
      `FOR u IN Users FILTER u.email == @email RETURN u`,
      { email }
    );
    if (await cursor.next()) {
      return res.status(400).json({ msg: "Email đã tồn tại" });
    }

    // Lưu mật khẩu dạng văn bản thô (plain text)
    const meta = await Users.save({
      name,
      email,
      password, // Lưu trực tiếp password mà không mã hóa
      role: "user",
      createdAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "Đăng ký thành công",
      userId: meta._key,
    });
  } catch (error) {
    console.error("Lỗi trong đăng ký:", error);
    res.status(500).json({ msg: "Lỗi server", error: error.message });
  }
});

// Đăng nhập
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ msg: "Thiếu email hoặc mật khẩu" });
    }

    const cursor = await db.query(
      `FOR u IN Users FILTER u.email == @email RETURN u`,
      { email }
    );
    const user = await cursor.next();

    if (!user) {
      return res.status(400).json({ msg: "Sai email hoặc mật khẩu" });
    }

    // So sánh mật khẩu dạng văn bản thô
    if (password !== user.password) {
      return res.status(400).json({ msg: "Sai email hoặc mật khẩu" });
    }

    const token = jwt.sign(
      { uid: user._key, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      success: true,
      token,
      user: { id: user._key, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Lỗi trong đăng nhập:", error);
    res.status(500).json({ msg: "Lỗi server", error: error.message });
  }
});

module.exports = router;
