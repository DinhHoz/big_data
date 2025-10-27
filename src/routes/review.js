// src/routes/review.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middlewares/auth");

const Reviews = db.collection("Reviews");
const Products = db.collection("Products");
const WRITE = db.collection("WRITE");
const EVALUATE = db.collection("EVALUATE");
const Kv = db.collection("KvStore");

// helper: recalc avg and cache
async function recalcAndCacheAvg(productKey) {
  const cursor = await db.query(
    `
    FOR r IN Reviews
      FILTER r.productId == @pid
      COLLECT WITH COUNT INTO cnt, avg = AVERAGE(r.rating)
      RETURN { count: cnt, avg: avg }
  `,
    { pid: productKey }
  );
  const stats = await cursor.next();
  const avg = stats ? stats.avg : null;
  const count = stats ? stats.count : 0;
  const kvKey = `avgRating:${productKey}`;
  if (await Kv.exists(kvKey)) {
    await Kv.update(kvKey, { value: avg });
  } else {
    await Kv.save({ _key: kvKey, value: avg });
  }
  await db.query(
    `UPDATE @key WITH { meta: { totalReviews: @count, avgRating: @avg } } IN Products`,
    { key: productKey, count, avg }
  );
  return { avg, count };
}

// add review (auth required)
router.post("/", auth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { productId, rating, comment, images = [] } = req.body;
    const saved = await Reviews.save({
      productId,
      userId,
      rating,
      comment,
      images,
      createdAt: new Date().toISOString(),
    });
    const reviewKey = saved._key;

    // create edges
    await WRITE.save({ _from: `Users/${userId}`, _to: `Reviews/${reviewKey}` });
    await EVALUATE.save({
      _from: `Reviews/${reviewKey}`,
      _to: `Products/${productId}`,
    });

    // push summary into product.reviews atomically
    const pushAql = `
      LET u = DOCUMENT(CONCAT('Users/', @userId))
      LET summary = {
        reviewId: @reviewKey,
        userId: @userId,
        userName: u ? u.name : null,
        rating: @rating,
        comment: @comment,
        images: @images,
        createdAt: @createdAt
      }
      UPDATE @productKey WITH { reviews: APPEND(OLD.reviews ? OLD.reviews : [], [summary]) } IN Products
      RETURN NEW
    `;
    const createdAt = new Date().toISOString();
    const cursor = await db.query(pushAql, {
      userId,
      reviewKey,
      rating,
      comment,
      images,
      createdAt,
      productKey: productId,
    });
    const updatedProduct = await cursor.next();

    // recalc & cache
    const stats = await recalcAndCacheAvg(productId);
    res.json({ ok: true, reviewKey, product: updatedProduct, stats });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// get reviews from embedded product
router.get("/product/:productId", async (req, res) => {
  try {
    const p = await Products.document(req.params.productId);
    res.json({ reviews: p.reviews || [], meta: p.meta || {} });
  } catch (e) {
    res.status(404).json({ error: "Product not found" });
  }
});

// delete review
router.delete("/:reviewKey", auth, async (req, res) => {
  try {
    const rid = req.params.reviewKey;
    const r = await Reviews.document(rid);
    const productId = r.productId;

    await Reviews.remove(rid);
    await db.query(`FOR e IN WRITE FILTER e._to == @rid REMOVE e IN WRITE`, {
      rid: `Reviews/${rid}`,
    });
    await db.query(
      `FOR e IN EVALUATE FILTER e._from == @rid REMOVE e IN EVALUATE`,
      { rid: `Reviews/${rid}` }
    );

    // remove embedded
    await db.query(
      `
      FOR p IN Products FILTER p._key == @pid
        LET newReviews = (
          FOR rev IN p.reviews FILTER rev.reviewId != @rid RETURN rev
        )
        UPDATE p WITH { reviews: newReviews } IN Products
    `,
      { pid: productId, rid }
    );

    const stats = await recalcAndCacheAvg(productId);
    res.json({ ok: true, stats });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
