const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
app.use(cors()); // 允许跨域请求
app.use(bodyParser.json()); // 解析JSON请求体

// 使用绝对路径连接 SQLite 数据库
const dbPath = path.resolve(__dirname, "barcodes.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database", err);
  } else {
    console.log("Database connected successfully");
  }
});

// 处理前端条形码验证的 POST 请求
app.post("/api/validate-barcode", (req, res) => {
  const { barcode } = req.body;

  // 从 SQLite 数据库中查询条形码区间
  db.get(
    "SELECT * FROM barcodes WHERE ? BETWEEN barcode_start AND barcode_end",
    [barcode],
    (err, row) => {
      if (err) {
        console.error("Error querying database", err.message);
        res.status(500).json({ message: "数据库查询错误" });
      } else if (row) {
        res.json({ message: `验证成功，物品信息: ${row.item_info}` });
      } else {
        res.json({ message: "条形码不存在" });
      }
    }
  );
});

// 启动服务器
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
