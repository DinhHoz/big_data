// src/routes/review.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../config/db");
const { auth } = require("../middlewares/auth");

const Reviews = db.collection("Reviews");
const Products = db.collection("Products");
const Users = db.collection("Users");
const UserReviews = db.collection("user_reviews"); // ✅ EDGE: user → review
const ProductReviews = db.collection("product_reviews"); // ✅ EDGE: review → product

// ==========================================================
// CẤU HÌNH MULTER – Lưu ảnh vào /uploads/reviews/
// ==========================================================
const uploadDir = path.join(__dirname, "../uploads/reviews");
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
  limits: { fileSize: 5 * 1024 * 1024 },
});

const deleteFileIfUploaded = (imagePath) => {
  if (imagePath && imagePath.startsWith("/uploads/reviews")) {
    const absPath = path.join(__dirname, "../", imagePath);
    if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
  }
};

// ==========================================================
// CẬP NHẬT META (avgRating, totalReviews)
// ==========================================================
async function updateProductReviewMeta(productId) {
  try {
    const result = await db.query(
      `
      LET reviews = (
        FOR r IN Reviews
          FILTER r.productId == @pid
          RETURN r.rating
      )
      LET total = LENGTH(reviews)
      LET avg = total > 0 ? MIN([5, ROUND((SUM(reviews) / total) * 10) / 10]) : 0

      UPDATE @pid WITH { 
        meta: { avgRating: avg, totalReviews: total } 
      } IN Products
      RETURN NEW
      `,
      { pid: productId }
    );
    return result._result?.[0];
  } catch (err) {
    console.error("Lỗi update meta:", err);
  }
}

// ==========================================================
// POST /api/reviews – TẠO ĐÁNH GIÁ MỚI
// ==========================================================
router.post("/", auth, upload.array("images", 5), async (req, res) => {
  try {
    const { productId, rating, comment } = req.body;
    const user = req.user;

    if (!productId || !comment?.trim()) {
      req.files?.forEach((f) =>
        deleteFileIfUploaded(`/uploads/reviews/${f.filename}`)
      );
      return res.status(400).json({ error: "Thiếu productId hoặc bình luận." });
    }

    const imagePaths = req.files.map((f) => `/uploads/reviews/${f.filename}`);
    const newReview = {
      productId,
      userId: user._key,
      rating: parseInt(rating),
      comment: comment.trim(),
      images: imagePaths,
      createdAt: new Date().toISOString(),
    };

    // 1️⃣ Lưu vào Reviews
    const saveResult = await Reviews.save(newReview);
    const reviewId = saveResult._key;
    const userName = user.name || "Người dùng ẩn";

    // 2️⃣ Cập nhật mảng reviews trong Products
    const reviewForProduct = {
      reviewId,
      userId: user._key,
      userName,
      rating: newReview.rating,
      comment: newReview.comment,
      images: newReview.images,
      createdAt: newReview.createdAt,
    };

    await db.query(
      `
      UPDATE @pid WITH {
        reviews: APPEND(DOCUMENT('Products', @pid).reviews || [], @reviewObj)
      } IN Products
      `,
      { pid: productId, reviewObj: reviewForProduct }
    );

    // ✅ GRAPH LOGIC — thêm cạnh vào đồ thị
    try {
      await UserReviews.save({
        _from: `Users/${user._key}`,
        _to: `Reviews/${reviewId}`,
        type: "WRITE",
        createdAt: new Date().toISOString(),
      });

      await ProductReviews.save({
        _from: `Reviews/${reviewId}`,
        _to: `Products/${productId}`,
        type: "ABOUT",
        createdAt: new Date().toISOString(),
      });
    } catch (graphErr) {
      console.warn("⚠️ Lỗi tạo cạnh graph:", graphErr.message);
    }

    // 3️⃣ Cập nhật meta
    await updateProductReviewMeta(productId);

    // 4️⃣ Trả về client
    res.status(201).json({
      message: "Đánh giá đã được gửi thành công!",
      review: {
        reviewId,
        ...newReview,
        userName,
        user: { _key: user._key, name: userName },
      },
    });
  } catch (err) {
    console.error("Lỗi POST /reviews:", err);
    req.files?.forEach((f) =>
      deleteFileIfUploaded(`/uploads/reviews/${f.filename}`)
    );
    res.status(500).json({ error: "Lỗi server khi tạo đánh giá." });
  }
});

// ==========================================================
// PUT /api/reviews/:reviewKey – CẬP NHẬT ĐÁNH GIÁ
// ==========================================================
router.put("/:reviewKey", auth, upload.array("images", 5), async (req, res) => {
  try {
    const rid = req.params.reviewKey;
    const { rating, comment, existingImages } = req.body;
    const user = req.user;

    const oldReview = await Reviews.document(rid).catch(() => null);
    if (!oldReview)
      return res.status(404).json({ error: "Không tìm thấy đánh giá." });

    if (oldReview.userId !== user._key && user.role !== "admin")
      return res.status(403).json({ error: "Không có quyền sửa." });

    // Ảnh
    let pathsToKeep = [];
    try {
      pathsToKeep = JSON.parse(existingImages || "[]");
    } catch {}
    const newImagePaths = req.files.map(
      (f) => `/uploads/reviews/${f.filename}`
    );
    const finalImages = [...pathsToKeep, ...newImagePaths];
    (oldReview.images || []).forEach((img) => {
      if (!pathsToKeep.includes(img)) deleteFileIfUploaded(img);
    });

    const updatedFields = {
      rating: parseInt(rating),
      comment: comment.trim(),
      images: finalImages,
      updatedAt: new Date().toISOString(),
    };
    await Reviews.update(rid, updatedFields);

    const updatedReview = await Reviews.document(rid);
    const userName = user.name || "Người dùng ẩn";

    // Cập nhật trong Products.reviews
    await db.query(
      `
      FOR p IN Products
        FILTER p._key == @pid
        LET newReviews = (
          FOR rev IN p.reviews || []
            RETURN rev.reviewId == @rid ? @reviewObj : rev
        )
        UPDATE p WITH { reviews: newReviews } IN Products
      `,
      {
        pid: oldReview.productId,
        rid,
        reviewObj: {
          reviewId: rid,
          userId: updatedReview.userId,
          userName,
          rating: updatedReview.rating,
          comment: updatedReview.comment,
          images: updatedReview.images,
          createdAt: updatedReview.createdAt,
        },
      }
    );

    if (oldReview.rating !== parseInt(rating))
      await updateProductReviewMeta(oldReview.productId);

    res.json({
      message: "Cập nhật thành công!",
      review: { reviewId: rid, ...updatedReview, userName },
    });
  } catch (err) {
    console.error("Lỗi PUT /reviews:", err);
    req.files?.forEach((f) =>
      deleteFileIfUploaded(`/uploads/reviews/${f.filename}`)
    );
    res.status(500).json({ error: "Lỗi server khi cập nhật." });
  }
});

// ==========================================================
// DELETE /api/reviews/:reviewKey – XÓA ĐÁNH GIÁ
// ==========================================================
router.delete("/:reviewKey", auth, async (req, res) => {
  const rid = req.params.reviewKey;
  const user = req.user;

  try {
    const reviewDoc = await Reviews.document(rid).catch(() => null);
    if (!reviewDoc)
      return res.status(404).json({ error: "Không tìm thấy đánh giá." });

    if (reviewDoc.userId !== user._key && user.role !== "admin")
      return res.status(403).json({ error: "Không có quyền xóa." });

    (reviewDoc.images || []).forEach(deleteFileIfUploaded);
    await Reviews.remove(rid);

    // Xóa khỏi product.reviews
    await db.query(
      `
      FOR p IN Products
        FILTER p._key == @pid
        LET filtered = (
          FOR rev IN p.reviews || []
            FILTER rev.reviewId != @rid
            RETURN rev
        )
        UPDATE p WITH { reviews: filtered } IN Products
      `,
      { pid: reviewDoc.productId, rid }
    );

    // ✅ Xóa cạnh graph
    try {
      await db.query(
        `
        FOR edge IN user_reviews
          FILTER edge._to == @rid
          REMOVE edge IN user_reviews
        `,
        { rid: `Reviews/${rid}` }
      );
      await db.query(
        `
        FOR edge IN product_reviews
          FILTER edge._from == @rid
          REMOVE edge IN product_reviews
        `,
        { rid: `Reviews/${rid}` }
      );
    } catch (graphErr) {
      console.warn("⚠️ Lỗi xóa cạnh graph:", graphErr.message);
    }

    await updateProductReviewMeta(reviewDoc.productId);
    res.json({ success: true, message: "Xóa thành công!" });
  } catch (err) {
    console.error("Lỗi DELETE /reviews:", err);
    res.status(500).json({ error: "Lỗi server khi xóa." });
  }
});

// ==========================================================
// GET /api/reviews/product/:productId – LẤY DANH SÁCH ĐÁNH GIÁ
// ==========================================================
router.get("/product/:productId", async (req, res) => {
  const productId = req.params.productId;
  try {
    const productDoc = await Products.document(productId);
    if (!productDoc)
      return res.status(404).json({ error: "Sản phẩm không tồn tại" });

    const rawReviews = productDoc.reviews || [];
    const reviews = await Promise.all(
      rawReviews.map(async (rev) => {
        let userName = "Người dùng ẩn";
        try {
          const userDoc = await Users.document(rev.userId);
          userName = userDoc.name || "Người dùng ẩn";
        } catch {}
        return { ...rev, userName };
      })
    );

    res.json({
      reviews,
      avgRating: productDoc.meta?.avgRating || 0,
      totalReviews: productDoc.meta?.totalReviews || reviews.length,
    });
  } catch (err) {
    console.error("Lỗi GET /reviews/product/:id:", err);
    res.status(500).json({ error: "Lỗi server khi lấy đánh giá." });
  }
});

module.exports = router;
