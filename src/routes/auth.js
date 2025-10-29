// src/routes/auth.js (ĐÃ CHỈNH SỬA: BỎ MÃ HÓA PASSWORD)
const express = require("express");
const router = express.Router();
const db = require("../config/db"); // Giả định
// const bcrypt = require("bcryptjs"); // ĐÃ BỎ MÃ HÓA PASSWORD
const jwt = require("jsonwebtoken");
require("dotenv").config(); // Để sử dụng process.env.JWT_SECRET

const Users = db.collection("Users");

// === Đăng ký (Hỗ trợ Admin cho Dev/Test) ===
router.post("/register", async (req, res) => {
  try {
    // ✅ THÊM isAdmin vào req.body
    const { name, email, password, isAdmin } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ msg: "Thiếu thông tin đăng ký." });
    }

    const cursor = await db.query(
      `FOR u IN Users FILTER u.email == @email RETURN u`,
      { email }
    );
    if (await cursor.next()) {
      return res.status(400).json({ msg: "Email đã được sử dụng." });
    } // BỎ MÃ HÓA: LƯU PASSWORD DƯỚI DẠNG PLAIN TEXT // Trong mã gốc: const hashed = await bcrypt.hash(password, 10);

    const plaintextPassword = password; // ⚠️ LOGIC THÊM: Xác định role là 'admin' nếu isAdmin=true (DEV/TEST ONLY)

    const role = isAdmin ? "admin" : "user";

    const meta = await Users.save({
      name,
      email,
      password: plaintextPassword, // ✅ LƯU DƯỚI DẠNG PLAIN TEXT
      role, // ✅ Lưu vai trò mới
      createdAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `Đăng ký thành công! Vai trò: ${role}.`, // ✅ Trả về vai trò
      userId: meta._key,
    });
  } catch (error) {
    console.error("❌ Lỗi đăng ký:", error);
    res.status(500).json({ msg: "Lỗi server." });
  }
});

// === Đăng nhập ===
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ msg: "Thiếu email hoặc mật khẩu." });

    const cursor = await db.query(
      `FOR u IN Users FILTER u.email == @email RETURN u`,
      { email }
    );
    const user = await cursor.next();
    if (!user) return res.status(400).json({ msg: "Sai email hoặc mật khẩu." });

    if (user.password !== password) {
      return res.status(400).json({ msg: "Sai email hoặc mật khẩu." });
    }

    // ĐÃ SỬA: Thêm `name` vào payload
    const token = jwt.sign(
      {
        _key: user._key, // đổi từ uid → _key (đồng bộ với middleware)
        name: user.name, // THÊM DÒNG NÀY
        email: user.email,
        role: user.role || "user",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" } // khuyến nghị 7 ngày
    );

    res.json({
      token,
      user: {
        _key: user._key,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    res.status(500).json({ msg: "Lỗi server." });
  }
});

module.exports = router;
