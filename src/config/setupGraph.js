// src/config/setupGraph.js
const db = require("./db"); // phải trả về instance arangojs Database
const util = require("util");

async function setupGraph() {
  const graphName = "reviewsGraph";

  try {
    // 1) Tạo edge collections nếu chưa có
    const edges = ["user_reviews", "product_reviews"];
    for (const edge of edges) {
      const exists = await db.collection(edge).exists();
      if (!exists) {
        await db.createEdgeCollection(edge);
        console.log(`✅ Đã tạo edge collection: ${edge}`);
      } else {
        console.log(`ℹ️ Edge collection đã tồn tại: ${edge}`);
      }
    }

    // 2) Kiểm tra graph bằng REST API (gharial)
    try {
      // GET /_api/gharial/{graphName}
      await db.request({
        method: "get",
        path: `/_api/gharial/${encodeURIComponent(graphName)}`,
      });
      console.log(`ℹ️ Graph ${graphName} đã tồn tại`);
      console.log("🎉 Cấu hình graph hoàn tất!");
      return;
    } catch (err) {
      // nếu statusCode === 404 thì graph chưa tồn tại -> tiếp tục tạo
      const status =
        err && err.code
          ? err.code
          : (err && err.response && err.response.status) || null;
      if (status && status !== 404) {
        console.warn(
          "⚠️ Lỗi khi kiểm tra graph (tiếp tục thử tạo):",
          err.message || err
        );
      } else {
        console.log(`ℹ️ Graph ${graphName} chưa tồn tại. Tiến hành tạo...`);
      }
      // tiếp tục tạo graph
    }

    // 3) Tạo graph bằng POST /_api/gharial
    const graphPayload = {
      name: graphName,
      edgeDefinitions: [
        {
          collection: "user_reviews",
          from: ["Users"],
          to: ["Reviews"],
        },
        {
          collection: "product_reviews",
          from: ["Reviews"],
          to: ["Products"],
        },
      ],
    };

    try {
      const resp = await db.request({
        method: "post",
        path: "/_api/gharial",
        body: graphPayload,
      });

      // resp.body có data trả về
      console.log(`🚀 Graph ${graphName} đã được tạo thành công (via REST).`);
      // optional: console.log(util.inspect(resp.body, false, 2, true));
      console.log("🎉 Cấu hình graph hoàn tất!");
    } catch (createErr) {
      // Có thể bị conflict nếu ai đó vừa tạo song song
      const message =
        createErr &&
        (createErr.message || createErr.response?.body || createErr);
      console.error("❌ Lỗi tạo graph:", message);
    }
  } catch (err) {
    console.error("❌ Lỗi khi thiết lập graph:", err);
  }
}

setupGraph().catch((e) => {
  console.error("❌ Unhandled error khi chạy setupGraph:", e);
  process.exit(1);
});
