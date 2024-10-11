const mongoose = require("mongoose");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");

// 定义 MongoDB 数据模型
const Barcode = mongoose.model(
  "Barcode",
  new mongoose.Schema({
    customer_id: String,
    po_number: String,
    item_code: String,
    series_number_start: String,
    series_number_end: String,
    item_info: String,
  })
);

// 导入条形码数据到 MongoDB
const importBarcodesToDatabase = async (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error("Excel file not found at " + filePath);
  }

  const workbook = xlsx.readFile(filePath);
  const sheet_name_list = workbook.SheetNames;
  const barcodes = xlsx.utils.sheet_to_json(
    workbook.Sheets[sheet_name_list[0]]
  );

  // 删除旧数据并导入新数据
  await Barcode.deleteMany({});
  await Barcode.insertMany(
    barcodes.map((barcode) => ({
      customer_id: barcode["Customer ID"].trim(),
      po_number: barcode["PO Number"].toString().trim(),
      item_code: barcode["Item Code"].trim(),
      series_number_start: barcode["Series Number Start"]
        .toString()
        .padStart(4, "0")
        .trim(),
      series_number_end: barcode["Series Number End"]
        .toString()
        .padStart(4, "0")
        .trim(),
      item_info: barcode["Item Info"].trim(),
    }))
  );

  console.log("条形码数据已成功导入到 MongoDB");
};

module.exports = { importBarcodesToDatabase };
