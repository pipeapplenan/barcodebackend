const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const xlsx = require("xlsx");

// 确定数据库路径
const dbPath = path.resolve("/tmp", "barcodes.db");
console.log("Database path for import:", dbPath);

const importBarcodesToDatabase = (callback) => {
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error("Error opening database", err);
      return callback(err); // 错误时调用 callback
    } else {
      console.log("Database opened successfully");
    }
  });

  // 读取 Excel 文件
  const excelFilePath = path.resolve("/tmp", "barcodes.xlsx");
  const workbook = xlsx.readFile("excelFilePath");
  const sheet_name_list = workbook.SheetNames;
  const barcodes = xlsx.utils.sheet_to_json(
    workbook.Sheets[sheet_name_list[0]]
  );

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
      series_number_start TEXT, 
      series_number_end TEXT, 
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
            const customerId = barcode["Customer ID"].trim();
            const poNumber = barcode["PO Number"].toString().trim();
            const itemCode = barcode["Item Code"].trim();
            const seriesNumberStart = barcode["Series Number Start"]
              .toString()
              .padStart(4, "0")
              .trim();
            const seriesNumberEnd = barcode["Series Number End"]
              .toString()
              .padStart(4, "0")
              .trim();
            const itemInfo = barcode["Item Info"].trim();

            // 插入到数据库中
            stmt.run(
              customerId,
              poNumber,
              itemCode,
              seriesNumberStart,
              seriesNumberEnd,
              itemInfo,
              (err) => {
                if (err) {
                  console.error("Error inserting data:", err.message);
                } else {
                  console.log(
                    `Inserted barcode range (${seriesNumberStart} - ${seriesNumberEnd}) into 'barcodes' table.`
                  );
                }
              }
            );
          });

          // 结束插入
          stmt.finalize((err) => {
            if (err) {
              console.error("Error finalizing statement:", err.message);
              return callback(err);
            }
            console.log("Statement finalized successfully.");

            // **关闭数据库**
            db.close((err) => {
              if (err) {
                console.error("Error closing database:", err.message);
                return callback(err);
              }
              console.log("Database closed successfully.");
              callback(null, "Database import successful");
            });
          });
        }
      }
    );
  });
};

module.exports = { importBarcodesToDatabase };
