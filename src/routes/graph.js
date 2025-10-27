// src/routes/graph.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");

// recommend products for user (simple traversal example)
router.get("/recommend/:userId", async (req, res) => {
  try {
    const userId = `Users/${req.params.userId}`;
    const query = `
      FOR v, e, p IN 1..2 OUTBOUND @user GRAPH 'reviewsGraph'
        FILTER IS_SAME_COLLECTION('Products', v)
        RETURN DISTINCT v
    `;
    const cursor = await db.query(query, { user: userId });
    const data = await cursor.all();
    res.json({ success: true, recommendations: data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// fraud detection example: identical reviews (same rating + same comment)
router.get("/fraud-detection", async (req, res) => {
  try {
    const query = `
      FOR r1 IN Reviews
        FOR r2 IN Reviews
          FILTER r1._key < r2._key
          FILTER r1.rating == r2.rating && r1.comment == r2.comment
          RETURN { r1: r1._key, r2: r2._key, rating: r1.rating, comment: r1.comment }
    `;
    const cursor = await db.query(query);
    const pairs = await cursor.all();
    res.json({ success: true, suspiciousPairs: pairs });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
