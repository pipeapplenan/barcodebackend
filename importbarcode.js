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
    `CREATE TABLE IF NOT EXISTS barcodes (
      customer_id TEXT, 
      po_number TEXT, 
      item_code TEXT, 
      series_number_start INTEGER, 
      series_number_end INTEGER, 
      item_info TEXT
    )`,
    (err) => {
      if (err) {
        console.error("Error creating table:", err.message);
      } else {
        console.log("Table 'barcodes' created successfully.");

        // 准备插入数据的语句
        const stmt = db.prepare(
          `INSERT INTO barcodes 
           (customer_id, po_number, item_code, series_number_start, series_number_end, item_info) 
           VALUES (?, ?, ?, ?, ?, ?)`
        );

        // 遍历 Excel 文件中的每一行并插入到数据库中
        barcodes.forEach((barcode) => {
          stmt.run(
            barcode["Customer ID"],
            barcode["PO Number"],
            barcode["Item Code"],
            barcode["Series Number Start"], // 不需要转换为整数，直接使用文本
            barcode["Series Number End"],
            barcode["Item Info"],
            (err) => {
              if (err) {
                console.error("Error inserting data:", err.message);
              } else {
                console.log(
                  `Inserted barcode range (${barcode["Series Number Start"]} - ${barcode["Series Number End"]}) into 'barcodes' table.`
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
