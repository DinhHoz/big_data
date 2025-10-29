// src/server.js
const express = require("express");
const cors = require("cors");
const path = require("path"); // ✅ Bổ sung import path
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// ✅ Cho phép truy cập file ảnh tĩnh trong uploads (products, reviews,...)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// 🔹 Nếu thư mục uploads nằm ở "src/uploads", dùng dòng dưới:
// app.use("/uploads", express.static(path.join(__dirname, "src/uploads")));

// ✅ Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/product"));
app.use("/api/reviews", require("./routes/review"));
app.use("/api/graph", require("./routes/graph"));

// ✅ Khởi chạy server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log(`📂 Static files served from: /uploads`);
});
