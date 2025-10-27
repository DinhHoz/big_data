// src/routes/product.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");

const Products = db.collection("Products");
const Kv = db.collection("KvStore");

// Create product
router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const meta = await Products.save({
      ...body,
      reviews: [],
      meta: { totalReviews: 0, avgRating: null },
      createdAt: new Date().toISOString(),
    });
    res.json(meta);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Read all products (attach avgRating from KvStore if exists)
router.get("/", async (req, res) => {
  try {
    const cursor = await db.query("FOR p IN Products RETURN p");
    const products = await cursor.all();
    for (const p of products) {
      const kvKey = `avgRating:${p._key}`;
      try {
        if (await Kv.exists(kvKey)) {
          const kv = await Kv.document(kvKey);
          p.meta = p.meta || {};
          p.meta.avgRating = kv.value;
        }
      } catch {}
    }
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get product by id (embedded reviews included)
router.get("/:id", async (req, res) => {
  try {
    const p = await Products.document(req.params.id);
    res.json(p);
  } catch (e) {
    res.status(404).json({ error: "Product not found" });
  }
});

// Update product
router.put("/:id", async (req, res) => {
  try {
    await Products.update(req.params.id, req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete product
router.delete("/:id", async (req, res) => {
  try {
    await Products.remove(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
