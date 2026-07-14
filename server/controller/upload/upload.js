const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const ExcelJS = require("exceljs"); // 🚀 Sabse fast aur reliable package
const db = require("../../config/db");
const { successResponse, errorResponse } = require("../../utils/responseFormatter");

const afsHeaders = [
    "Amazon Order Id", "Merchant Order Id", "Shipment ID", "Shipment Item Id",
    "Amazon Order Item Id", "Merchant Order Item Id", "Purchase Date",
    "Payments Date", "Shipment Date", "Reporting Date", "Buyer Email",
    "Buyer Name", "Buyer Phone Number", "Merchant SKU", "Title",
    "Shipped Quantity", "Currency", "Item Price", "Item Tax",
    "Shipping Price", "Shipping Tax", "Gift Wrap Price", "Gift Wrap Tax",
    "Recipient Name", "Shipping Address 1", "Shipping Address 2",
    "Shipping Address 3", "Shipping City", "Shipping State",
    "Shipping Postal Code", "Shipping Country Code", "Shipping Phone Number",
    "Billing Address 1", "Billing Address 2", "Billing Address 3",
    "Billing City", "Billing State", "bill-postal-code", "bill-country",
    "Item Promo Discount", "Shipment Promo Discount", "Carrier",
    "Tracking Number", "Estimated Arrival Date", "FC", "Fulfillment Channel",
    "Sales Channel"
];

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

const uploadAFSReport = async (req, res) => {
    const connection = await db.getConnection();
    let reportId = null;

    try {
        if (!req.file) {
            return errorResponse(res, "Please upload a file", 400);
        }

        const totalStartTime = Date.now();
        await connection.beginTransaction();

        const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2) + " MB";
        const fileExt = path.extname(req.file.originalname).toLowerCase();

        const [masterResult] = await connection.query(
            `INSERT INTO uploaded_reports (file_name, report_type, file_size, status)
             VALUES (?, 'AFS', ?, 'Processing')`,
            [req.file.filename, fileSizeMB]
        );
        reportId = masterResult.insertId;

        // ⏱️ TIMER 1: Smart File Parsing (Ultra-Fast & Crash-Proof Logic)
        console.time("⏳ TIMER 1: File Parsing Time");
        let rawData = [];

        if (fileExt === '.csv') {
            rawData = await parseCsv(req.file.path);
        } else {
            // 🚀 BUG FIX: Async Iterator se padhenge, ab kabhi hang nahi hoga aur styles ignore karega
            const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(req.file.path, {
                styles: 'ignore',
                sharedStrings: 'cache',
                hyperlinks: 'ignore',
                worksheets: 'emit'
            });

            let sheetHeaders = [];
            let isFirstRow = true;

            for await (const worksheet of workbookReader) {
                for await (const row of worksheet) {
                    // Agar Excel me puri row khali hai toh usko yahin chhod do
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
                                // Agar object/rich-text hai toh string me convert karo
                                if (val && typeof val === 'object') {
                                    if (val.result !== undefined) {
                                        val = val.result;
                                    } else if (val.richText) {
                                        val = val.richText.map(rt => rt.text).join('');
                                    } else {
                                        val = cell.text;
                                    }
                                }
                                obj[header] = val !== undefined ? val : null;
                            }
                        });
                        rawData.push(obj);
                    }
                }
                break; // Pehli sheet padhne ke baad loop turant band kar do
            }
        }
        console.timeEnd("⏳ TIMER 1: File Parsing Time");

        if (rawData.length === 0) {
            throw new Error("Uploaded file is empty or formatted incorrectly.");
        }

        // 🚨 STRICT VALIDATION: Check if it's actually an AFS Report
        const firstRowKeys = Object.keys(rawData[0]);
        if (!firstRowKeys.includes("Amazon Order Id") && !firstRowKeys.includes("Merchant SKU")) {
            throw new Error("Mismatched Report! Ye AFS Report nahi hai. Please sahi file upload karein.");
        }

        console.time("⏳ TIMER 2: Data Preparation Time");
        const bulkValues = [];
        rawData.forEach((row) => {
            const rowValues = [reportId];
            let hasData = false;

            afsHeaders.forEach((header) => {
                const cellValue = row[header] !== undefined ? row[header] : null;
                rowValues.push(cellValue);
                if (cellValue !== null && cellValue !== "") {
                    hasData = true;
                }
            });

            if (hasData) {
                bulkValues.push(rowValues);
            }
        });
        console.timeEnd("⏳ TIMER 2: Data Preparation Time");

        console.time("⏳ TIMER 3: Database Insertion Time");
        const insertQuery = `INSERT INTO afs_data (report_id, amazon_order_id, merchant_order_id, shipment_id, shipment_item_id, amazon_order_item_id, merchant_order_item_id, purchase_date, payments_date, shipment_date, reporting_date, buyer_email, buyer_name, buyer_phone_number, merchant_sku, title, shipped_quantity, currency, item_price, item_tax, shipping_price, shipping_tax, gift_wrap_price, gift_wrap_tax, recipient_name, shipping_address_1, shipping_address_2, shipping_address_3, shipping_city, shipping_state, shipping_postal_code, shipping_country_code, shipping_phone_number, billing_address_1, billing_address_2, billing_address_3, billing_city, billing_state, bill_postal_code, bill_country, item_promo_discount, shipment_promo_discount, carrier, tracking_number, estimated_arrival_date, fc, fulfillment_channel, sales_channel) VALUES ?`;

        const CHUNK_SIZE = 500;
        for (let i = 0; i < bulkValues.length; i += CHUNK_SIZE) {
            const chunk = bulkValues.slice(i, i + CHUNK_SIZE);
            await connection.query(insertQuery, [chunk]);
        }
        console.timeEnd("⏳ TIMER 3: Database Insertion Time");

        await connection.query(
            `UPDATE uploaded_reports SET status = 'Success' WHERE id = ?`,
            [reportId]
        );

        await connection.commit();
        connection.release();

        const timeTaken = ((Date.now() - totalStartTime) / 1000).toFixed(2);
        console.log(`✅ Upload completed in ${timeTaken} seconds\n`);

        return successResponse(res, "AFS Report uploaded and saved to DB successfully!", {
            reportId,
            fileName: req.file.filename,
            totalRecordsInserted: bulkValues.length,
            timeTaken: `${timeTaken} seconds`
        }, 201);

    } catch (error) {
        console.error("Upload Error:", error);

        if (connection) {
            await connection.rollback();
            if (reportId) {
                await connection.query(
                    `UPDATE uploaded_reports SET status = 'Failed' WHERE id = ?`,
                    [reportId]
                );
            }
            connection.release();
        }

        return errorResponse(res, error.message || "Failed to process the report", 500);
    }
};

// Business Report ke exact headers file se map karne ke liye
const businessHeaders = [
    "(Parent) ASIN", "(Child) ASIN", "Title", "SKU", "Units Ordered",
    "Units Ordered - B2B", "Unit Session Percentage", "Unit Session Percentage - B2B",
    "Ordered Product Sales", "Ordered Product Sales - B2B", "Total Order Items",
    "Total Order Items - B2B"
];

// Helper Function: String me se commas, currency symbols aur % hatane ke liye
const sanitizeNumber = (val, isFloat = false) => {
    if (val === null || val === undefined || val === '') return 0;

    // Agar pehle se number hai toh direct return karo
    if (typeof val === 'number') return val;

    // Agar object hai (jaise exceljs formula object), toh uski string value nikalo
    let str = typeof val === 'object' ? (val.result !== undefined ? val.result.toString() : '') : val.toString();

    // Spaces, currency symbols, commas aur % sign ko remove karo
    let cleanStr = str.replace(/[%₹,]/g, '').trim();

    if (cleanStr === '' || isNaN(cleanStr)) return 0;

    return isFloat ? parseFloat(cleanStr) : parseInt(cleanStr, 10);
};

const uploadBusinessReport = async (req, res) => {
    const connection = await db.getConnection();
    let reportId = null;

    try {
        if (!req.file) {
            return errorResponse(res, "Please upload a file", 400);
        }

        const totalStartTime = Date.now();
        await connection.beginTransaction();

        const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2) + " MB";
        const fileExt = path.extname(req.file.originalname).toLowerCase();

        // 1. Master report table mein Business entry create karein
        const [masterResult] = await connection.query(
            `INSERT INTO uploaded_reports (file_name, report_type, file_size, status)
             VALUES (?, 'Business', ?, 'Processing')`,
            [req.file.filename, fileSizeMB]
        );
        reportId = masterResult.insertId;

        console.time("⏳ TIMER 1: Business File Parsing Time");
        let rawData = [];

        if (fileExt === '.csv') {
            rawData = await parseCsv(req.file.path);
        } else {
            // Wahi super-fast stream reader jo AFS me kaam aaya
            const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(req.file.path, {
                styles: 'ignore',
                sharedStrings: 'cache',
                hyperlinks: 'ignore',
                worksheets: 'emit'
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
        console.timeEnd("⏳ TIMER 1: Business File Parsing Time");

        if (rawData.length === 0) {
            throw new Error("Uploaded Business file is empty or formatted incorrectly.");
        }

        // 🚨 STRICT VALIDATION: Check if it's actually a Business Report
        const firstRowKeys = Object.keys(rawData[0]);
        if (!firstRowKeys.includes("(Parent) ASIN") && !firstRowKeys.includes("Units Ordered")) {
            throw new Error("Mismatched Report! Ye Business Report nahi hai. Please sahi file upload karein.");
        }

        console.time("⏳ TIMER 2: Business Data Preparation Time");
        const bulkValues = [];

        rawData.forEach((row) => {
            // Table columns logic ke sath sequence maintain kar rahe hain
            const parentAsin = row["(Parent) ASIN"] || null;
            const childAsin = row["(Child) ASIN"] || null;
            const title = row["Title"] || null;
            const sku = row["SKU"] || null;

            // Numeric validation aur data sanitization apply kar rahe hain
            const unitsOrdered = sanitizeNumber(row["Units Ordered"]);
            const unitsOrderedB2b = sanitizeNumber(row["Units Ordered - B2B"]);
            const unitSessionPercentage = sanitizeNumber(row["Unit Session Percentage"], true);
            const unitSessionPercentageB2b = sanitizeNumber(row["Unit Session Percentage - B2B"], true);
            const orderedProductSales = sanitizeNumber(row["Ordered Product Sales"], true);
            const orderedProductSalesB2b = sanitizeNumber(row["Ordered Product Sales - B2B"], true);
            const totalOrderItems = sanitizeNumber(row["Total Order Items"]);
            const totalOrderItemsB2b = sanitizeNumber(row["Total Order Items - B2B"]);

            // Sirf wahi rows insert karenge jisme SKU ya ASIN ho (faltu blank rows skip)
            if (sku || childAsin) {
                bulkValues.push([
                    reportId, parentAsin, childAsin, title, sku,
                    unitsOrdered, unitsOrderedB2b, unitSessionPercentage, unitSessionPercentageB2b,
                    orderedProductSales, orderedProductSalesB2b, totalOrderItems, totalOrderItemsB2b
                ]);
            }
        });
        console.timeEnd("⏳ TIMER 2: Business Data Preparation Time");

        console.time("⏳ TIMER 3: Business Database Insertion Time");
        const insertQuery = `
            INSERT INTO business_data (
                report_id, parent_asin, child_asin, title, sku, 
                units_ordered, units_ordered_b2b, unit_session_percentage, unit_session_percentage_b2b, 
                ordered_product_sales, ordered_product_sales_b2b, total_order_items, total_order_items_b2b
            ) VALUES ?
        `;

        const CHUNK_SIZE = 500;
        for (let i = 0; i < bulkValues.length; i += CHUNK_SIZE) {
            const chunk = bulkValues.slice(i, i + CHUNK_SIZE);
            await connection.query(insertQuery, [chunk]);
        }
        console.timeEnd("⏳ TIMER 3: Business Database Insertion Time");

        // Status 'Success' mark karein
        await connection.query(
            `UPDATE uploaded_reports SET status = 'Success' WHERE id = ?`,
            [reportId]
        );

        await connection.commit();
        connection.release();

        const timeTaken = ((Date.now() - totalStartTime) / 1000).toFixed(2);
        console.log(`✅ Business Report Upload completed in ${timeTaken} seconds\n`);

        return successResponse(res, "Business Report uploaded and processed successfully!", {
            reportId,
            fileName: req.file.filename,
            totalRecordsInserted: bulkValues.length,
            timeTaken: `${timeTaken} seconds`
        }, 201);

    } catch (error) {
        console.error("Business Upload Error:", error);

        if (connection) {
            await connection.rollback();
            if (reportId) {
                await connection.query(
                    `UPDATE uploaded_reports SET status = 'Failed' WHERE id = ?`,
                    [reportId]
                );
            }
            connection.release();
        }

        return errorResponse(res, error.message || "Failed to process the business report", 500);
    }
};

// DIH Report ke headers
const dihHeaders = [
    "Date", "FNSKU", "ASIN", "MSKU", "Title", "Disposition",
    "Starting Warehouse Balance", "In Transit Between Warehouses", "Receipts",
    "Customer Shipments", "Customer Returns", "Vendor Returns",
    "Warehouse Transfer In/Out", "Found", "Lost", "Damaged", "Disposed",
    "Other Events", "Ending Warehouse Balance", "Unknown Events", "Location"
];

const uploadDIHReport = async (req, res) => {
    const connection = await db.getConnection();
    let reportId = null;

    try {
        if (!req.file) {
            return errorResponse(res, "Please upload a file", 400);
        }

        const totalStartTime = Date.now();
        await connection.beginTransaction();

        const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2) + " MB";
        const fileExt = path.extname(req.file.originalname).toLowerCase();

        // Master table mein DIH ki entry
        const [masterResult] = await connection.query(
            `INSERT INTO uploaded_reports (file_name, report_type, file_size, status)
             VALUES (?, 'DIH', ?, 'Processing')`,
            [req.file.filename, fileSizeMB]
        );
        reportId = masterResult.insertId;

        console.time("⏳ TIMER 1: DIH File Parsing");
        let rawData = [];

        if (fileExt === '.csv') {
            rawData = await parseCsv(req.file.path);
        } else {
            const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(req.file.path, {
                styles: 'ignore',
                sharedStrings: 'cache',
                hyperlinks: 'ignore',
                worksheets: 'emit'
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
        console.timeEnd("⏳ TIMER 1: DIH File Parsing");

        if (rawData.length === 0) {
            throw new Error("Uploaded DIH file is empty or formatted incorrectly.");
        }

        // 🚨 STRICT VALIDATION: Check if it's actually a DIH Report
        const firstRowKeys = Object.keys(rawData[0]);
        if (!firstRowKeys.includes("Starting Warehouse Balance") && !firstRowKeys.includes("FNSKU")) {
            throw new Error("Mismatched Report! Ye DIH Report nahi hai. Please sahi file upload karein.");
        }

        console.time("⏳ TIMER 2: DIH Data Prep");
        const bulkValues = [];

        rawData.forEach((row) => {
            // Strings
            const reportDate = row["Date"] || null;
            const fnsku = row["FNSKU"] || null;
            const asin = row["ASIN"] || null;
            const msku = row["MSKU"] || null;
            const title = row["Title"] || null;
            const disposition = row["Disposition"] || null;
            const location = row["Location"] || null;

            // Numbers (sanitizeNumber wahi upar wala helper function use karega)
            const startBal = sanitizeNumber(row["Starting Warehouse Balance"]);
            const inTransit = sanitizeNumber(row["In Transit Between Warehouses"]);
            const receipts = sanitizeNumber(row["Receipts"]);
            const custShipments = sanitizeNumber(row["Customer Shipments"]);
            const custReturns = sanitizeNumber(row["Customer Returns"]);
            const vendorReturns = sanitizeNumber(row["Vendor Returns"]);
            const transferInOut = sanitizeNumber(row["Warehouse Transfer In/Out"]);
            const found = sanitizeNumber(row["Found"]);
            const lost = sanitizeNumber(row["Lost"]);
            const damaged = sanitizeNumber(row["Damaged"]);
            const disposed = sanitizeNumber(row["Disposed"]);
            const otherEvents = sanitizeNumber(row["Other Events"]);
            const unknownEvents = sanitizeNumber(row["Unknown Events"]);
            const endBal = sanitizeNumber(row["Ending Warehouse Balance"]);

            // Sirf valid inventory items (jinka MSKU/FNSKU ho) unhe daalenge
            if (msku || fnsku) {
                bulkValues.push([
                    reportId, reportDate, fnsku, asin, msku, title, disposition, location,
                    startBal, inTransit, receipts, custShipments, custReturns, vendorReturns,
                    transferInOut, found, lost, damaged, disposed, otherEvents, unknownEvents, endBal
                ]);
            }
        });
        console.timeEnd("⏳ TIMER 2: DIH Data Prep");

        console.time("⏳ TIMER 3: DIH Database Insertion");
        const insertQuery = `
            INSERT INTO dih_data (
                report_id, report_date, fnsku, asin, msku, title, disposition, location,
                starting_warehouse_balance, in_transit_between_warehouses, receipts,
                customer_shipments, customer_returns, vendor_returns, warehouse_transfer_in_out,
                found, lost, damaged, disposed, other_events, unknown_events, ending_warehouse_balance
            ) VALUES ?
        `;

        const CHUNK_SIZE = 500;
        for (let i = 0; i < bulkValues.length; i += CHUNK_SIZE) {
            const chunk = bulkValues.slice(i, i + CHUNK_SIZE);
            await connection.query(insertQuery, [chunk]);
        }
        console.timeEnd("⏳ TIMER 3: DIH Database Insertion");

        await connection.query(
            `UPDATE uploaded_reports SET status = 'Success' WHERE id = ?`,
            [reportId]
        );

        await connection.commit();
        connection.release();

        const timeTaken = ((Date.now() - totalStartTime) / 1000).toFixed(2);
        console.log(`✅ DIH Report Upload completed in ${timeTaken} seconds\n`);

        return successResponse(res, "DIH Report uploaded and processed successfully!", {
            reportId,
            fileName: req.file.filename,
            totalRecordsInserted: bulkValues.length,
            timeTaken: `${timeTaken} seconds`
        }, 201);

    } catch (error) {
        console.error("DIH Upload Error:", error);
        if (connection) {
            await connection.rollback();
            if (reportId) {
                await connection.query(
                    `UPDATE uploaded_reports SET status = 'Failed' WHERE id = ?`,
                    [reportId]
                );
            }
            connection.release();
        }
        return errorResponse(res, error.message || "Failed to process the DIH report", 500);
    }
};

const getRecentUploads = async (req, res) => {
    try {
        const connection = await db.getConnection();
        const [rows] = await connection.query(
            `SELECT id, file_name, report_type, file_size, status, uploaded_at 
             FROM uploaded_reports 
             ORDER BY uploaded_at DESC 
             LIMIT 5`
        );
        connection.release();

        return successResponse(res, "Recent uploads fetched successfully", rows, 200);
    } catch (error) {
        console.error("Fetch Recent Uploads Error:", error);
        return errorResponse(res, "Failed to fetch recent uploads", 500);
    }
};

const deleteReport = async (req, res) => {
    let connection;
    try {
        const reportId = req.params.id;
        connection = await db.getConnection();

        // 1. Pehle file ka naam nikal lo taaki storage se delete kar sakein
        const [rows] = await connection.query(`SELECT file_name FROM uploaded_reports WHERE id = ?`, [reportId]);

        if (rows.length === 0) {
            connection.release();
            return errorResponse(res, "Report not found", 404);
        }

        const fileName = rows[0].file_name;

        // 2. Database se delete karo (ON DELETE CASCADE automatically baaki tables saaf kar dega)
        await connection.query(`DELETE FROM uploaded_reports WHERE id = ?`, [reportId]);
        connection.release();

        // 3. Server (public/upload folder) se physical file ko bhi uda do taaki storage full na ho
        const filePath = path.join(__dirname, "../../client/public/upload", fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return successResponse(res, "Report deleted successfully!", null, 200);
    } catch (error) {
        console.error("Delete Report Error:", error);
        if (connection) connection.release();
        return errorResponse(res, "Failed to delete report", 500);
    }
};

// Naya function - Faltu rows skip karne ke liye
const parseCsvRaw = (filePath) => {
    return new Promise((resolve, reject) => {
        const results = [];
        const fs = require('fs');
        const csv = require('csv-parser');

        fs.createReadStream(filePath)
            .pipe(csv({ headers: false })) // headers: false lagane se ye raw array dega
            .on('data', (data) => results.push(Object.values(data)))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
};

// Transit Shipment Report ke NAYE exact headers
const transitHeaders = [
    "Default prep owner", "Default labeling owner", "Default prep category",
    "Merchant SKU", "Quantity", "FC", "Prep owner", "Labeling owner",
    "Prep category", "HSN/SAC code", "GST rate", "Declared value(per unit)"
];

const uploadTransitShipmentReport = async (req, res) => {
    const connection = await db.getConnection();
    let reportId = null;

    try {
        if (!req.file) {
            return errorResponse(res, "Please upload a file", 400);
        }

        const totalStartTime = Date.now();
        await connection.beginTransaction();

        const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2) + " MB";
        const fileExt = path.extname(req.file.originalname).toLowerCase();

        // 1. Master table mein Transit Shipment ki entry
        const [masterResult] = await connection.query(
            `INSERT INTO uploaded_reports (file_name, report_type, file_size, status)
             VALUES (?, 'Transit Shipment', ?, 'Processing')`,
            [req.file.filename, fileSizeMB]
        );
        reportId = masterResult.insertId;

        console.time("⏳ TIMER 1: Transit File Parsing");
        let rawData = [];

        // 🚀 GLOBAL VARIABLES: Jo top rows se ek baar defaults ko capture karengi
        let globalDefaultPrepOwner = null;
        let globalDefaultLabelingOwner = null;
        let globalDefaultPrepCategory = null;

        if (fileExt === '.csv') {
            // CSV ke liye Smart Scanner
            const rawRows = await parseCsvRaw(req.file.path);
            let headerRowIndex = -1;
            let sheetHeaders = [];

            for (let i = 0; i < rawRows.length; i++) {
                // Top rows se Global Default values check aur extract kar rahe hain
                rawRows[i].forEach((cell, idx) => {
                    if (cell) {
                        const txt = cell.toString().trim().toLowerCase();
                        if (txt.includes("default prep owner")) {
                            globalDefaultPrepOwner = rawRows[i][idx + 1] ? rawRows[i][idx + 1].toString().trim() : null;
                        }
                        if (txt.includes("default labeling owner")) {
                            globalDefaultLabelingOwner = rawRows[i][idx + 1] ? rawRows[i][idx + 1].toString().trim() : null;
                        }
                        if (txt.includes("default prep category")) {
                            globalDefaultPrepCategory = rawRows[i][idx + 1] ? rawRows[i][idx + 1].toString().trim() : null;
                        }
                    }
                });

                // Main table ke headers dhoondh rahe hain
                const isHeader = rawRows[i].some(cell => cell && cell.toString().toLowerCase().includes("merchant sku"));
                if (isHeader) {
                    headerRowIndex = i;
                    sheetHeaders = rawRows[i].map(h => h ? h.toString().trim() : null);
                    break;
                }
            }

            if (headerRowIndex !== -1) {
                // Header milne ke baad ki lines (product data) read karo
                for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
                    let obj = {};
                    sheetHeaders.forEach((header, index) => {
                        if (header) {
                            obj[header] = rawRows[i][index] !== undefined ? rawRows[i][index] : null;
                        }
                    });
                    rawData.push(obj);
                }
            }
        } else {
            // ExcelJS ke liye Smart Scanner
            const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(req.file.path, {
                styles: 'ignore', sharedStrings: 'cache', hyperlinks: 'ignore', worksheets: 'emit'
            });

            let sheetHeaders = [];
            let headerFound = false;

            for await (const worksheet of workbookReader) {
                for await (const row of worksheet) {
                    if (!row.hasValues) continue;

                    if (!headerFound) {
                        let tempHeaders = [];
                        let hasSku = false;

                        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                            let val = cell.value ? cell.value.toString().trim() : null;
                            if (val) {
                                const txt = val.toLowerCase();
                                // Excel cells se Global Defaults read kar rahe hain
                                if (txt.includes("default prep owner")) {
                                    const nextCell = row.getCell(colNumber + 1);
                                    globalDefaultPrepOwner = nextCell && nextCell.value ? nextCell.value.toString().trim() : null;
                                }
                                if (txt.includes("default labeling owner")) {
                                    const nextCell = row.getCell(colNumber + 1);
                                    globalDefaultLabelingOwner = nextCell && nextCell.value ? nextCell.value.toString().trim() : null;
                                }
                                if (txt.includes("default prep category")) {
                                    const nextCell = row.getCell(colNumber + 1);
                                    globalDefaultPrepCategory = nextCell && nextCell.value ? nextCell.value.toString().trim() : null;
                                }
                            }
                            tempHeaders[colNumber] = val;
                            if (val && val.toLowerCase().includes("merchant sku")) {
                                hasSku = true;
                            }
                        });

                        if (hasSku) {
                            headerFound = true;
                            sheetHeaders = tempHeaders;
                        }
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
        console.timeEnd("⏳ TIMER 1: Transit File Parsing");

        if (rawData.length === 0) {
            throw new Error("Mismatched Report! File me Merchant SKU wala column nahi mila.");
        }

        console.time("⏳ TIMER 2: Transit Data Prep");
        const bulkValues = [];

        rawData.forEach((row) => {
            // 🚀 SMART FIX: Row values me ab global settings use ho rahi hain jo har product par apply hongi
            const defPrepOwner = globalDefaultPrepOwner;
            const defLabelingOwner = globalDefaultLabelingOwner;
            const defPrepCategory = globalDefaultPrepCategory;

            const merchantSku = row["Merchant SKU"] || null;
            const fc = row["FC"] || null;
            const prepOwner = row["Prep owner"] || null;
            const labelingOwner = row["Labeling owner"] || null;
            const prepCategory = row["Prep category"] || null;

            const hsnSacCode = row["HSN/SAC code"] ? row["HSN/SAC code"].toString() : null;

            // Numbers
            const quantity = sanitizeNumber(row["Quantity"]);
            const gstRate = sanitizeNumber(row["GST rate"], true);
            const declaredValue = sanitizeNumber(row["Declared value(per unit)"], true);

            // Sirf valid rows insert karenge jisme SKU maujood ho
            if (merchantSku) {
                bulkValues.push([
                    reportId, defPrepOwner, defLabelingOwner, defPrepCategory,
                    merchantSku, quantity, fc, prepOwner, labelingOwner,
                    prepCategory, hsnSacCode, gstRate, declaredValue
                ]);
            }
        });
        console.timeEnd("⏳ TIMER 2: Transit Data Prep");

        console.time("⏳ TIMER 3: Transit DB Insert");
        const insertQuery = `
            INSERT INTO transit_shipment_data (
                report_id, default_prep_owner, default_labeling_owner, default_prep_category, 
                merchant_sku, quantity, fc, prep_owner, labeling_owner, prep_category, 
                hsn_sac_code, gst_rate, declared_value_per_unit
            ) VALUES ?
        `;

        const CHUNK_SIZE = 500;
        for (let i = 0; i < bulkValues.length; i += CHUNK_SIZE) {
            const chunk = bulkValues.slice(i, i + CHUNK_SIZE);
            await connection.query(insertQuery, [chunk]);
        }
        console.timeEnd("⏳ TIMER 3: Transit DB Insert");

        await connection.query(`UPDATE uploaded_reports SET status = 'Success' WHERE id = ?`, [reportId]);
        await connection.commit();
        connection.release();

        const timeTaken = ((Date.now() - totalStartTime) / 1000).toFixed(2);
        console.log(`✅ Transit Shipment Upload completed in ${timeTaken} seconds\n`);

        return successResponse(res, "Transit Shipment Report uploaded successfully!", {
            reportId,
            fileName: req.file.filename,
            totalRecordsInserted: bulkValues.length
        }, 201);

    } catch (error) {
        console.error("Transit Upload Error:", error);
        if (connection) {
            await connection.rollback();
            if (reportId) await connection.query(`UPDATE uploaded_reports SET status = 'Failed' WHERE id = ?`, [reportId]);
            connection.release();
        }
        return errorResponse(res, error.message || "Failed to process the Transit report", 500);
    }
};

// Module exports ko update karna mat bhoolna
module.exports = {
    uploadAFSReport,
    uploadBusinessReport,
    uploadDIHReport,
    getRecentUploads,
    deleteReport,
    uploadTransitShipmentReport
};