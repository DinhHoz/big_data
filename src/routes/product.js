// src/routes/product.js (ĐÃ CẬP NHẬT HOÀN CHỈNH - SỬ DỤNG MẢNG 'images' VÀ XỬ LÝ 1 ẢNH)
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../config/db");
const { auth, requireManager } = require("../middlewares/auth");

const Products = db.collection("Products");

// === Multer cấu hình upload ảnh sản phẩm ===
// Thư mục uploads nằm ngoài src/
const uploadDir = path.join(__dirname, "../uploads/products");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn 5MB
});

// Hàm trợ giúp để xóa ảnh vật lý
const deleteFileIfUploaded = (imagePath) => {
  // Chỉ xóa file vật lý nếu đường dẫn là cục bộ (bắt đầu bằng '/uploads/')
  if (
    imagePath &&
    imagePath.startsWith("/uploads/") &&
    fs.existsSync(path.join(__dirname, "../", imagePath))
  ) {
    fs.unlinkSync(path.join(__dirname, "../", imagePath));
  }
};

// === GET all products (Public) ===
router.get("/", async (req, res) => {
  try {
    const cursor = await db.query(`FOR p IN Products RETURN p`);
    const data = await cursor.all();
    res.json(data);
  } catch (err) {
    console.error("❌ Lỗi lấy danh sách sản phẩm:", err);
    res.status(500).json({ error: err.message });
  }
});

// === POST: thêm sản phẩm mới (Admin Only) ===
router.post(
  "/",
  auth,
  requireManager, // ✅ Phân quyền: Yêu cầu Admin
  upload.single("image"), // Tên trường trong form data là 'image'
  async (req, res) => {
    try {
      const { name, description, price, category } = req.body;
      let newImagePath = null;

      // 1. Ưu tiên file upload
      if (req.file) {
        newImagePath = `/uploads/products/${req.file.filename}`;
      } else if (req.body.imageUrl) {
        // 2. Nếu không có file, dùng URL từ input
        newImagePath = req.body.imageUrl;
      }

      // ⭐ Luôn tạo mảng 1 phần tử hoặc rỗng cho trường 'images' ⭐
      const images = newImagePath ? [newImagePath] : [];

      const newProduct = await Products.save({
        name,
        description,
        price: parseFloat(price),
        category,
        images, // <-- SỬ DỤNG TRƯỜNG 'images'
      });

      res.json(newProduct);
    } catch (err) {
      console.error("❌ Lỗi thêm sản phẩm:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// === PUT: cập nhật sản phẩm (Admin Only) ===
router.put(
  "/:id",
  auth,
  requireManager, // ✅ Phân quyền: Yêu cầu Admin
  upload.single("image"), // Tên trường trong form data là 'image'
  async (req, res) => {
    try {
      const { name, description, price, category } = req.body;
      const product = await Products.document(req.params.id);

      let finalImages = product.images || []; // Lấy ảnh cũ từ DB
      const oldImagePath = finalImages[0]; // Ảnh cũ (có thể null/undefined)

      let newImagePath = null;

      // Trường hợp 1: Có file upload mới (req.file)
      if (req.file) {
        newImagePath = `/uploads/products/${req.file.filename}`;

        // Xóa ảnh vật lý cũ (nếu nó là ảnh upload)
        deleteFileIfUploaded(oldImagePath);

        finalImages = [newImagePath]; // Thay thế bằng ảnh upload mới
      }
      // Trường hợp 2: Không có file mới, nhưng có gửi trường 'imageUrl' (người dùng nhập URL hoặc xóa)
      else if (req.body.imageUrl !== undefined) {
        // Lấy URL mới. Nếu req.body.imageUrl là rỗng, người dùng muốn xóa ảnh.
        newImagePath = req.body.imageUrl || null;

        // Nếu ảnh cũ là ảnh upload, phải xóa file vật lý
        if (newImagePath !== oldImagePath) {
          // Chỉ xóa nếu ảnh thực sự thay đổi hoặc bị xóa
          deleteFileIfUploaded(oldImagePath);
        }

        finalImages = newImagePath ? [newImagePath] : []; // Cập nhật mảng ảnh
      }
      // Trường hợp 3: Không có file mới và không gửi 'imageUrl': Giữ nguyên finalImages

      await Products.update(req.params.id, {
        name,
        description,
        price: parseFloat(price),
        category,
        images: finalImages, // <-- SỬ DỤNG TRƯỜNG 'images'
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("❌ Lỗi cập nhật sản phẩm:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// === DELETE: xóa sản phẩm (Admin Only) ===
router.delete("/:id", auth, requireManager, async (req, res) => {
  // ✅ Phân quyền: Yêu cầu Admin
  try {
    const product = await Products.document(req.params.id);

    // ⭐ Lấy ảnh đầu tiên từ mảng 'images' để xóa file vật lý ⭐
    const imagePath =
      product.images && product.images.length > 0 ? product.images[0] : null;

    // Chỉ xóa file vật lý nếu đường dẫn là cục bộ
    deleteFileIfUploaded(imagePath);

    await Products.remove(req.params.id);

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Lỗi xóa sản phẩm:", err);
    res.status(500).json({ error: err.message });
  }
});

// === GET product by ID (Public) ===
// Route này phải nằm trước các route có tham số khác nếu có
router.get("/:id", async (req, res) => {
  try {
    // Lấy chi tiết sản phẩm dựa trên ID (req.params.id)
    const product = await Products.document(req.params.id);

    if (!product) {
      // Trả về 404 nếu không tìm thấy sản phẩm
      return res.status(404).json({ error: "Sản phẩm không tồn tại." });
    }

    res.json(product);
  } catch (err) {
    // Lỗi có thể do ID không hợp lệ
    console.error(`❌ Lỗi lấy chi tiết sản phẩm ID ${req.params.id}:`, err);
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;
