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

// 中间件：打印出请求的URL
app.use((req, res, next) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(`Incoming request URL: ${fullUrl}`);
  next(); // 继续处理下一个中间件或路由
});

// 处理前端条形码验证的 POST 请求
app.post("/api/validate-barcode", (req, res) => {
  const { customerId, poNumber, itemCode, serialNumber } = req.body;

  // 确保 serialNumber 是字符串，并且补齐前导零为4位
  const serialNum =
    serialNumber.length === 4
      ? serialNumber
      : serialNumber.toString().padStart(4, "0");

  // 打印调试信息
  console.log("Request Body: ", req.body);
  console.log(
    "Parameters for query: ",
    customerId,
    poNumber,
    itemCode,
    serialNum
  );

  // 打印 SQL 查询以调试
  console.log(`
    SELECT * FROM barcodes 
    WHERE customer_id = '${customerId}' COLLATE NOCASE
    AND po_number = '${poNumber}' COLLATE NOCASE
    AND item_code = '${itemCode}' COLLATE NOCASE
    AND '${serialNum}' >= series_number_start
    AND '${serialNum}' <= series_number_end;
  `);

  // 从 SQLite 数据库中查询条形码区间
  db.get(
    `SELECT * FROM barcodes 
     WHERE customer_id = ? COLLATE NOCASE
     AND po_number = ? COLLATE NOCASE
     AND item_code = ? COLLATE NOCASE
     AND ? >= series_number_start
     AND ? <= series_number_end`,
    [customerId, poNumber, itemCode, serialNum, serialNum],
    (err, row) => {
      if (err) {
        console.error("Error querying database", err.message);
        res.status(500).json({ message: "数据库查询错误" });
      } else if (row) {
        console.log("Query result: ", row);
        res.json({ message: `验证成功，物品信息: ${row.item_info}` });
      } else {
        console.log("No matching record found.");
        res.json({ message: "条形码不存在" });
      }
    }
  );
});

// 启动服务器并监听端口
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// 导出 Express 应用作为 Vercel 的处理器
module.exports = app;
