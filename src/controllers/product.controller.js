const db = require("../config/db");

exports.getAllProducts = async (req, res) => {
  try {
    const cursor = await db.query(`FOR p IN Products RETURN p`);
    const products = await cursor.all();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addProduct = async (req, res) => {
  try {
    const collection = db.collection("Products");
    const product = await collection.save(req.body);
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
