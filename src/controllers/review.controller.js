const db = require("../config/db");

exports.addReview = async (req, res) => {
  const { productId, userId, rating, content } = req.body;
  try {
    const reviewCol = db.collection("Reviews");
    const review = await reviewCol.save({
      productId,
      userId,
      rating,
      content,
      date: new Date(),
    });

    // Tạo quan hệ Graph
    const writeEdge = db.edgeCollection("WRITE");
    await writeEdge.save({
      _from: `Users/${userId}`,
      _to: `Reviews/${review._key}`,
    });

    const evalEdge = db.edgeCollection("EVALUATE");
    await evalEdge.save({
      _from: `Reviews/${review._key}`,
      _to: `Products/${productId}`,
    });

    res.json({ message: "Thêm đánh giá thành công!", review });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getReviewsByProduct = async (req, res) => {
  const { productId } = req.params;
  try {
    const cursor = await db.query(
      `
      FOR r IN Reviews
        FILTER r.productId == @productId
        RETURN r
    `,
      { productId }
    );
    const reviews = await cursor.all();
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
