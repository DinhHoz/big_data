// src/config/db.js
const { Database } = require("arangojs");
require("dotenv").config();

// Sử dụng ARANGO_DB_NAME thay vì ARANGO_DB trong file .env
const DB_NAME = process.env.ARANGO_DB_NAME || "product_reviews";

const db = new Database({
  url: process.env.ARANGO_URL || "http://127.0.0.1:8529",

  // 🔥 FIX 1: Thêm databaseName vào đối tượng khởi tạo
  databaseName: DB_NAME,
});

db.useBasicAuth(
  process.env.ARANGO_USER || "root",
  process.env.ARANGO_PASS || "123"
);

// Bỏ dòng db.userDatabases() thừa thãi ở đây

module.exports = db;
