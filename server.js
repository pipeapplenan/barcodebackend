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
  const { customerId, poNumber, itemCode, serialNumber } = req.body;

  // 从 SQLite 数据库中查询条形码区间
  db.get(
    `SELECT * FROM barcodes 
    WHERE customer_id = ? COLLATE NOCASE
    AND po_number = ? COLLATE NOCASE
    AND item_code = ? COLLATE NOCASE
    AND ? BETWEEN series_number_start AND series_number_end`,
    [customerId, poNumber, itemCode, serialNumber],
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

// 导出 Express 应用作为 Vercel 的处理器
module.exports = app;
