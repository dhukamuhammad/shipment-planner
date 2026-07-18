const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const ExcelJS = require("exceljs");
const db = require("../../config/db");
const { successResponse, errorResponse } = require("../../utils/responseFormatter");

const sanitizeNumber = (val, isFloat = false) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    let str = typeof val === 'object' ? (val.result !== undefined ? val.result.toString() : '') : val.toString();
    let cleanStr = str.replace(/[%₹,]/g, '').trim();
    if (cleanStr === '' || isNaN(cleanStr)) return 0;
    return isFloat ? parseFloat(cleanStr) : parseInt(cleanStr, 10);
};

const parseCsv = (filePath) => {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
};

// =======================================================
// 1. UPLOAD AVAILABLE STOCK REPORT
// File Headers: Model, Category, Owner, Req.Stock, Avg., Balance
// =======================================================
const uploadStockReport = async (req, res) => {
    const connection = await db.getConnection();
    let reportId = null;
    try {
        if (!req.file) return errorResponse(res, "Please upload a file", 400);

        await connection.beginTransaction();

        const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2) + " MB";
        const fileExt = path.extname(req.file.originalname).toLowerCase();

        // uploaded_reports table me entry banao (history tracking ke liye)
        const [reportResult] = await connection.query(
            `INSERT INTO uploaded_reports (file_name, report_type, file_size, status) VALUES (?, 'Stock', ?, 'Processing')`,
            [req.file.filename, fileSizeMB]
        );
        reportId = reportResult.insertId;

        let rawData = [];
        if (fileExt === '.csv') {
            rawData = await parseCsv(req.file.path);
        } else {
            const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(req.file.path, {
                styles: 'ignore', sharedStrings: 'cache', hyperlinks: 'ignore', worksheets: 'emit'
            });
            let sheetHeaders = [];
            let isFirstRow = true;
            for await (const worksheet of workbookReader) {
                for await (const row of worksheet) {
                    if (!row.hasValues) continue;
                    if (isFirstRow) {
                        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                            sheetHeaders[colNumber] = cell.value ? cell.value.toString().trim() : null;
                        });
                        isFirstRow = false;
                    } else {
                        let obj = {};
                        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                            const header = sheetHeaders[colNumber];
                            if (header) {
                                let val = cell.value;
                                if (val && typeof val === 'object') {
                                    val = val.result !== undefined ? val.result : cell.text;
                                }
                                obj[header] = val !== undefined ? val : null;
                            }
                        });
                        rawData.push(obj);
                    }
                }
                break;
            }
        }

        if (rawData.length === 0) throw new Error("Uploaded file is empty!");

        const firstRowKeys = Object.keys(rawData[0]);
        if (!firstRowKeys.includes("Model") && !firstRowKeys.includes("Balance")) {
            throw new Error("Invalid file! 'Model' ya 'Balance' column nahi mila.");
        }

        // Model (Group Name) ke basis pe agar duplicate rows hain to sum karke merge karo
        const groupedData = {};
        rawData.forEach((row) => {
            const groupName = row["Model"] ? row["Model"].toString().trim() : null;
            if (!groupName) return;

            const category = row["Category"] ? row["Category"].toString().trim() : null;
            const owner = row["Owner"] ? row["Owner"].toString().trim() : null;
            const reqStock = sanitizeNumber(row["Req.Stock"]);
            const avgQty = sanitizeNumber(row["Avg."], true);
            const balance = sanitizeNumber(row["Balance"]);

            if (!groupedData[groupName]) {
                groupedData[groupName] = {
                    group_name: groupName,
                    category: category,
                    owner: owner,
                    req_stock: 0,
                    avg_qty: 0,
                    available_qty: 0
                };
            }
            groupedData[groupName].req_stock += reqStock;
            groupedData[groupName].avg_qty += avgQty;
            groupedData[groupName].available_qty += balance;
            // Category/Owner khali ho to naye se bhar do
            if (!groupedData[groupName].category && category) groupedData[groupName].category = category;
            if (!groupedData[groupName].owner && owner) groupedData[groupName].owner = owner;
        });

        // Purana stock data clear karo, naya daalo (poori file replace karti hai)
        await connection.query(`TRUNCATE TABLE stock_availability`);

        // 🔥 CHANGE 1: array me sabse pehle `reportId` add kiya (yehi aapka upload_id hai)
        const bulkValues = Object.values(groupedData).map((row) => [
            reportId, 
            row.group_name, 
            row.category, 
            row.owner, 
            row.req_stock, 
            row.avg_qty, 
            row.available_qty
        ]);

        if (bulkValues.length > 0) {
            // 🔥 CHANGE 2: Query me `upload_id` column ko add kiya
            await connection.query(
                `INSERT INTO stock_availability (upload_id, group_name, category, owner, req_stock, avg_qty, available_qty) VALUES ?`,
                [bulkValues]
            );
        }

        await connection.query(`UPDATE uploaded_reports SET status = 'Success' WHERE id = ?`, [reportId]);

        await connection.commit();
        connection.release();

        return successResponse(res, "Stock Availability Uploaded Successfully!", {
            reportId, totalGroups: bulkValues.length
        }, 201);

    } catch (error) {
        console.error("Stock Upload Error:", error);
        if (connection) {
            await connection.rollback();
            if (reportId) await connection.query(`UPDATE uploaded_reports SET status = 'Failed' WHERE id = ?`, [reportId]);
            connection.release();
        }
        return errorResponse(res, error.message || "Failed to process stock report", 500);
    }
};

// =======================================================
// 2. GET AVAILABLE STOCK (Group-wise)
// =======================================================
const getStockAvailability = async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        const [rows] = await connection.query(
            `SELECT group_name, category, owner, req_stock, avg_qty, available_qty FROM stock_availability`
        );
        connection.release();
        return successResponse(res, "Stock availability fetched successfully", rows, 200);
    } catch (error) {
        console.error("Get Stock Availability Error:", error);
        if (connection) connection.release();
        return errorResponse(res, "Failed to fetch stock availability", 500);
    }
};

module.exports = {
    uploadStockReport,
    getStockAvailability
};