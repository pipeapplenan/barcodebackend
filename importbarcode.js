const xlsx = require("xlsx");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// 确定数据库路径
const dbPath = path.resolve(__dirname, "barcodes.db");
console.log("Database path for import:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database:", err);
  } else {
    console.log("Database opened successfully");
  }
});

// 读取 Excel 文件
const workbook = xlsx.readFile("barcodes.xlsx");
const sheet_name_list = workbook.SheetNames;
const barcodes = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);

console.log("Data read from Excel file:");
console.log(barcodes);

db.serialize(() => {
  // 删除现有的 barcodes 表
  db.run("DROP TABLE IF EXISTS barcodes", (err) => {
    if (err) {
      console.error("Error dropping table:", err.message);
    } else {
      console.log("Existing 'barcodes' table dropped.");
    }
  });

  // 创建新的 barcodes 表
  db.run(
    "CREATE TABLE IF NOT EXISTS barcodes (barcode_start INTEGER, barcode_end INTEGER, item_info TEXT)",
    (err) => {
      if (err) {
        console.error("Error creating table:", err.message);
      } else {
        console.log("Table 'barcodes' created successfully.");

        // 准备插入数据的语句
        const stmt = db.prepare(
          "INSERT INTO barcodes (barcode_start, barcode_end, item_info) VALUES (?, ?, ?)"
        );

        // 遍历 Excel 文件中的每一行并插入到数据库中
        barcodes.forEach((barcode) => {
          stmt.run(
            parseInt(barcode.barcode_start, 10),
            parseInt(barcode.barcode_end, 10),
            barcode.item_info,
            (err) => {
              if (err) {
                console.error("Error inserting data:", err.message);
              } else {
                console.log(
                  `Inserted barcode range (${barcode.barcode_start} - ${barcode.barcode_end}) into 'barcodes' table.`
                );
              }
            }
          );
        });

        // 结束插入
        stmt.finalize((err) => {
          if (err) {
            console.error("Error finalizing statement:", err.message);
          } else {
            console.log("Statement finalized successfully.");
            // 确保所有操作完成后再关闭数据库
          }
        });
      }
    }
  );
});
