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

// ✅ 改用内存存储（避免写入 /tmp）
const upload = multer({ storage: multer.memoryStorage() });

// ✅ 修改上传接口逻辑
app.post("/api/upload", upload.single("file"), async (req, res) => {
  console.log("📦 [UPLOAD] 请求收到 /api/upload");
  console.log("req.file =", req.file && { name: req.file.originalname, size: req.file.size });

  if (!req.file) {
    return res.status(400).json({ message: "没有上传文件" });
  }

  // 检查空文件
  if (req.file.size === 0) {
    return res.status(400).json({ message: "上传文件为空" });
  }

  try {
    // ✅ 在内存中创建缓存文件路径（仅在同次函数执行内有效）
    const cacheFileName = `cache_${new Date().toISOString().replace(/:/g, "-")}.xlsx`;
    const cacheFilePath = path.join("/tmp", cacheFileName);

    // ✅ 写入 /tmp 同步（几 KB 无压力）
    fs.writeFileSync(cacheFilePath, req.file.buffer);
    console.log(`文件已缓存到: ${cacheFilePath}`);

    // 返回路径
    res.status(200).json({
      message: "文件上传成功并已缓存",
      filePath: cacheFilePath,
    });
  } catch (err) {
    console.error("写入缓存失败:", err);
    res.status(500).json({ message: "文件缓存失败", error: err.message });
  }
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
