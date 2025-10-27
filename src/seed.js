// src/seed.js
const db = require("./config/db");

async function seed() {
  try {
    // Users
    await db
      .collection("Users")
      .save(
        { _key: "user1", name: "Võ Trần Minh", email: "minh@example.com" },
        { overwrite: true }
      );
    await db
      .collection("Users")
      .save(
        { _key: "user2", name: "Nguyễn Anh", email: "anh@example.com" },
        { overwrite: true }
      );
    await db
      .collection("Users")
      .save(
        { _key: "user3", name: "Trần Hà", email: "ha@example.com" },
        { overwrite: true }
      );

    // Products (embedded reviews)
    await db.collection("Products").save(
      {
        _key: "prod1",
        name: "iPhone 15",
        description: "Apple flagship, A17 chip, camera 48MP",
        price: 33990000,
        images: [],
        reviews: [
          {
            reviewId: "rev1",
            userId: "user1",
            userName: "Minh",
            rating: 5,
            comment: "Tuyệt vời, pin trâu",
            createdAt: new Date().toISOString(),
          },
          {
            reviewId: "rev2",
            userId: "user2",
            userName: "Anh",
            rating: 4,
            comment: "Tốt nhưng giá cao",
            createdAt: new Date().toISOString(),
          },
        ],
        meta: { totalReviews: 2, avgRating: 4.5 },
        createdAt: new Date().toISOString(),
      },
      { overwrite: true }
    );

    await db.collection("Products").save(
      {
        _key: "prod2",
        name: "Galaxy S24",
        description: "Samsung flagship, camera mạnh",
        price: 28990000,
        images: [],
        reviews: [],
        meta: { totalReviews: 0, avgRating: null },
        createdAt: new Date().toISOString(),
      },
      { overwrite: true }
    );

    // Reviews canonical
    await db.collection("Reviews").save(
      {
        _key: "rev1",
        productId: "prod1",
        userId: "user1",
        rating: 5,
        comment: "Tuyệt vời, pin trâu",
        createdAt: new Date().toISOString(),
      },
      { overwrite: true }
    );
    await db.collection("Reviews").save(
      {
        _key: "rev2",
        productId: "prod1",
        userId: "user2",
        rating: 4,
        comment: "Tốt nhưng giá cao",
        createdAt: new Date().toISOString(),
      },
      { overwrite: true }
    );

    // Edges
    await db
      .edgeCollection("WRITE")
      .save({ _from: "Users/user1", _to: "Reviews/rev1" });
    await db
      .edgeCollection("WRITE")
      .save({ _from: "Users/user2", _to: "Reviews/rev2" });
    await db
      .edgeCollection("EVALUATE")
      .save({ _from: "Reviews/rev1", _to: "Products/prod1" });
    await db
      .edgeCollection("EVALUATE")
      .save({ _from: "Reviews/rev2", _to: "Products/prod1" });

    // KV cache
    await db
      .collection("KvStore")
      .save({ _key: "avgRating:prod1", value: 4.5 }, { overwrite: true });
    await db
      .collection("KvStore")
      .save({ _key: "views:prod1", value: 512 }, { overwrite: true });

    console.log("✅ Seed data inserted successfully");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed error:", err);
    process.exit(1);
  }
}

seed();
