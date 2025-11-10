const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const { importBarcodesToDatabase } = require("./importbarcode");

// 连接 MongoDB
const mongoUri = process.env.MONGO_URI;
mongoose.connect(mongoUri);

const BarcodeSchema = new mongoose.Schema({
  customer_id: String,
  po_number: String,
  item_code: String,
  series_number_start: String,
  series_number_end: String,
  item_info: String,
});

// 避免模型重复定义错误
const Barcode =
  mongoose.models.Barcode || mongoose.model("Barcode", BarcodeSchema);

const app = express();

// 设置 CORS 以允许来自特定域的请求
app.use(
  cors({
    origin: ["https://pipeapplenan.github.io", "http://localhost:3000", "https://barcodetest.saitys.com"], // 允许多个来源
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    optionsSuccessStatus: 204,
  })
);

// 处理所有 OPTIONS 请求的响应
app.options("*", cors());

app.use(bodyParser.json());

// 上传文件时将其存储到 /tmp 目录下
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "/tmp");
  },
  filename: function (req, file, cb) {
    const timeStamp = new Date().toISOString().replace(/:/g, "-");
    const originalFileName = file.originalname;
    const ext = path.extname(originalFileName);
    const baseName = path.basename(originalFileName, ext);
    const newFileName = `${baseName}_${timeStamp}${ext}`;
    cb(null, newFileName);
  },
});

const upload = multer({ storage: storage });

// 文件上传的 POST 请求处理
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("没有上传文件");
  }
  console.log("Uploaded file:", req.file.path);

  // 缓存文件路径
  const cacheFileName = `cache_${new Date()
    .toISOString()
    .replace(/:/g, "-")}.xlsx`;
  const cacheFilePath = path.join("/tmp", cacheFileName);

  fs.copyFile(req.file.path, cacheFilePath, (err) => {
    if (err) {
      console.error("Error caching file:", err);
    }
    console.log(`File cached successfully as ${cacheFileName}`);
  });

  res.status(200).json({
    message: "文件上传成功并已缓存",
    filePath: req.file.path,
  });
});


// 导入条形码数据的 POST 请求处理
app.post("/api/import-barcodes", async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) {
    return res.status(400).json({ message: "文件路径未提供" });
  }

  try {
    await importBarcodesToDatabase(filePath);
    res.status(200).json({ message: "条形码数据导入成功" });
  } catch (error) {
    res.status(500).json({ message: "导入条形码数据时出错: " + error.message });
  }
});

// 查询所有条形码数据
app.get("/api/barcodes", async (req, res) => {
  try {
    const barcodes = await Barcode.find();
    res.status(200).json(barcodes);
  } catch (error) {
    res.status(500).json({ message: "数据库查询错误" });
  }
});

// 条形码验证的 POST 请求
app.post("/api/validate-barcode", async (req, res) => {
  const { customerId, poNumber, itemCode, serialNumber } = req.body;
  const serialNum = serialNumber.toString().padStart(4, "0");

  try {
    const barcode = await Barcode.findOne({
      customer_id: customerId,
      po_number: poNumber,
      item_code: itemCode,
      series_number_start: { $lte: serialNum },
      series_number_end: { $gte: serialNum },
    });

    if (barcode) {
      res.json({ message: `验证成功，物品信息: ${barcode.item_info}` });
    } else {
      res.json({ message: "条形码不存在" });
    }
  } catch (error) {
    res.status(500).json({ message: "数据库查询错误" });
  }
});

// 启动服务器并监听端口
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
