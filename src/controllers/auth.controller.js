const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

exports.register = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const collection = db.collection("Users");
    const hash = await bcrypt.hash(password, 10);
    await collection.save({ name, email, password: hash, role: "user" });
    res.json({ message: "Đăng ký thành công!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const cursor = await db.query(
      `
      FOR u IN Users FILTER u.email == @email RETURN u
    `,
      { email }
    );
    const user = await cursor.next();
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Sai mật khẩu" });
    const token = jwt.sign(
      { id: user._key, role: user.role },
      process.env.JWT_SECRET
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
