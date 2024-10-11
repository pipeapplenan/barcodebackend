const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { importBarcodesToDatabase } = require("./importbarcode"); // 导入封装好的导入函数
const multer = require("multer");
const fs = require("fs");

const app = express();
app.use(
  cors({
    origin: "https://pipeapplenan.github.io", // 只允许来自这个域名的跨域请求
    methods: ["GET", "POST"], // 允许的 HTTP 方法
    allowedHeaders: ["Content-Type"], // 允许的请求头
  })
);

app.use(bodyParser.json());

// 获取当前时间并格式化为 YYYYMMDD_HHmmss
const getTimeStamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
};

// 配置 multer，将文件保存到 server 目录下
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // cb(null, path.join(__dirname)); // 将文件保存到 server 目录
    cb(null, "/tmp");
  },
  filename: function (req, file, cb) {
    // 生成带有时间戳的文件名
    const timeStamp = getTimeStamp();
    const originalFileName = file.originalname;
    const ext = path.extname(originalFileName);
    const baseName = path.basename(originalFileName, ext);
    const newFileName = `${baseName}_${timeStamp}${ext}`;
    cb(null, newFileName); // 保存带有时间戳的文件名
  },
});

const upload = multer({ storage: storage });

// 文件上传的 POST 请求处理
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("没有上传文件");
  }
  console.log("Uploaded file:", req.file.path);

  // 这里返回上传成功并返回文件路径（包括时间戳）
  res.status(200).json({
    message: "文件上传成功",
    filePath: req.file.path,
  });

  // 将上传文件的路径加入缓存处理
  const cacheFileName = `cache_${getTimeStamp()}.xlsx`;
  // const cacheFilePath = path.join(__dirname, "cache", cacheFileName);
  const cacheFilePath = path.join("/tmp", cacheFileName); // 保存到 /tmp

  // 确保缓存目录存在
  if (!fs.existsSync(path.join(__dirname, "cache"))) {
    fs.mkdirSync(path.join(__dirname, "cache"));
  }

  // 复制上传的文件到缓存目录，并命名为带时间戳的文件
  fs.copyFile(req.file.path, cacheFilePath, (err) => {
    if (err) {
      console.error("Error caching file:", err);
      return res.status(500).json({ message: "文件缓存错误" });
    }
    console.log(`File cached successfully as ${cacheFileName}`);
    res
      .status(200)
      .json({ message: "文件上传成功并已缓存", filePath: req.file.path });
  });
});

// 导入条形码数据的 POST 请求处理
app.post("/api/import-barcodes", (req, res) => {
  const { filePath } = req.body; // 从请求中获取 filePath

  if (!filePath) {
    return res.status(400).json({ message: "文件路径未提供" }); // 如果没有提供文件路径，立即返回
  }

  // 调用 importBarcodesToDatabase 函数，传入 filePath
  importBarcodesToDatabase(filePath, (err, result) => {
    if (err) {
      console.error("Error during import:", err.message);
      // 发生错误时，立即返回错误响应
      return res
        .status(500)
        .json({ message: "Error importing barcodes: " + err.message });
    }

    // 如果没有错误，返回成功响应
    console.log("Import successful:", result);
    return res.status(200).json({ message: "Database import successful" });
  });
});

//查看数据库中有多少数据
app.get("/api/barcodes", (req, res) => {
  const dbPath = path.resolve("/tmp", "barcodes.db"); // 数据库路径

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      return res.status(500).json({ message: "数据库连接错误" });
    }

    // 查询所有条形码数据
    db.all("SELECT * FROM barcodes", (err, rows) => {
      if (err) {
        return res.status(500).json({ message: "数据库查询错误" });
      }

      res.status(200).json(rows); // 返回查询到的所有数据
    });

    db.close(); // 关闭数据库连接
  });
});

// 处理前端条形码验证的 POST 请求
app.post("/api/validate-barcode", (req, res) => {
  const { customerId, poNumber, itemCode, serialNumber } = req.body;

  // 确保 serialNumber 是字符串，并且补齐前导零为4位
  const serialNum =
    serialNumber.length === 4
      ? serialNumber
      : serialNumber.toString().padStart(4, "0");

  // 打开数据库连接
  const dbPath = path.resolve("/tmp", "barcodes.db");
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error("Error opening database", err);
      return res.status(500).json({ message: "数据库连接错误" });
    }
    console.log("Database opened successfully for validation.");

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
          db.close(); // 确保在查询后关闭数据库
          return res.status(500).json({ message: "数据库查询错误" });
        } else if (row) {
          console.log("Query result: ", row);
          db.close(); // 查询完成后关闭数据库
          return res.json({ message: `验证成功，物品信息: ${row.item_info}` });
        } else {
          console.log("No matching record found.");
          db.close(); // 查询后关闭数据库
          return res.json({ message: "条形码不存在" });
        }
      }
    );
  });
});

// 启动服务器并监听端口
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
