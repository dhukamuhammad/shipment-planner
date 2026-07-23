const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const ExcelJS = require("exceljs"); // 🚀 Sabse fast aur reliable package
const db = require("../../config/db");
const { successResponse, errorResponse } = require("../../utils/responseFormatter");

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

const afsColumnMap = {
    amazon_order_id: "Amazon Order Id",
    merchant_order_id: "Merchant Order Id",
    shipment_id: "Shipment ID",
    shipment_item_id: "Shipment Item Id",
    amazon_order_item_id: "Amazon Order Item Id",
    merchant_order_item_id: "Merchant Order Item Id",
    purchase_date: "Purchase Date",
    payments_date: "Payments Date",
    shipment_date: "Shipment Date",
    reporting_date: "Reporting Date",
    buyer_email: "Buyer Email",
    buyer_name: "Buyer Name",
    buyer_phone_number: "Buyer Phone Number",
    merchant_sku: "Merchant SKU",
    title: "Title",
    shipped_quantity: "Shipped Quantity",
    currency: "Currency",
    item_price: "Item Price",
    item_tax: "Item Tax",
    shipping_price: "Shipping Price",
    shipping_tax: "Shipping Tax",
    gift_wrap_price: "Gift Wrap Price",
    gift_wrap_tax: "Gift Wrap Tax",
    recipient_name: "Recipient Name",
    shipping_address_1: "Shipping Address 1",
    shipping_address_2: "Shipping Address 2",
    shipping_address_3: "Shipping Address 3",
    shipping_city: "Shipping City",
    shipping_state: "Shipping State",
    shipping_postal_code: "Shipping Postal Code",
    shipping_country_code: "Shipping Country Code",
    shipping_phone_number: "Shipping Phone Number",
    billing_address_1: "Billing Address 1",
    billing_address_2: "Billing Address 2",
    billing_address_3: "Billing Address 3",
    billing_city: "Billing City",
    billing_state: "Billing State",
    bill_postal_code: "bill-postal-code",
    bill_country: "bill-country",
    item_promo_discount: "Item Promo Discount",
    shipment_promo_discount: "Shipment Promo Discount",
    carrier: "Carrier",
    tracking_number: "Tracking Number",
    estimated_arrival_date: "Estimated Arrival Date",
    fc: "FC",
    fulfillment_channel: "Fulfillment Channel",
    sales_channel: "Sales Channel"
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
        const marketplace_id = req.body.marketplace_id || null;

        const [masterResult] = await connection.query(
            `INSERT INTO uploaded_reports (file_name, report_type, file_size, status, marketplace_id)
             VALUES (?, 'AFS', ?, 'Processing', ?)`,
            [req.file.filename, fileSizeMB, marketplace_id]
        );
        reportId = masterResult.insertId;

        // ⏱️ TIMER 1: Smart File Parsing (Ultra-Fast & Crash-Proof Logic)
        console.time("⏳ TIMER 1: File Parsing Time");
        let rawData = [];

        if (fileExt === '.csv') {
            rawData = await parseCsv(req.file.path);
        } else {
            // 🚀 Async Iterator se padhenge, ab kabhi hang nahi hoga aur styles ignore karega
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

        // 🚨 DYNAMIC STRICT VALIDATION: (Map se automatic dhoondhega)
        const firstRowKeys = Object.keys(rawData[0]);

        // Map se current names nikal rahe hain
        const expectedOrderIdHeader = afsColumnMap.amazon_order_id; // e.g. "Amazon Order Id"
        const expectedSkuHeader = afsColumnMap.merchant_sku;       // e.g. "Merchant SKU"

        if (!firstRowKeys.includes(expectedOrderIdHeader) && !firstRowKeys.includes(expectedSkuHeader)) {
            throw new Error(`Mismatched Report! File me '${expectedOrderIdHeader}' ya '${expectedSkuHeader}' column nahi mila. Please sahi file upload karein.`);
        }

        // ⏱️ TIMER 2: Data Preparation Time
        console.time("⏳ TIMER 2: Data Preparation Time");
        const bulkValues = [];

        // Map keys nikalne ke liye
        const dbColumns = Object.keys(afsColumnMap);

        rawData.forEach((row) => {
            // Har row me pehle reportId (Foreign Key) push hogi
            const rowValues = [reportId];
            let hasData = false;

            // Database columns ke sequence ke mutabik file se value nikalenge
            dbColumns.forEach((dbCol) => {
                const excelHeader = afsColumnMap[dbCol]; // Smartly mapped excel header name
                const cellValue = row[excelHeader] !== undefined ? row[excelHeader] : null;

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

        // ⏱️ TIMER 3: Database Insertion Time
        console.time("⏳ TIMER 3: Database Insertion Time");

        // Dynamic Insert Query (Map ke basis pe)
        const insertQuery = `INSERT INTO afs_data (report_id, ${dbColumns.join(', ')}) VALUES ?`;

        const CHUNK_SIZE = 500;
        for (let i = 0; i < bulkValues.length; i += CHUNK_SIZE) {
            const chunk = bulkValues.slice(i, i + CHUNK_SIZE);
            await connection.query(insertQuery, [chunk]);
        }
        console.timeEnd("⏳ TIMER 3: Database Insertion Time");

        // // --- 🗑️ AUTO DELETE OLD DATA LOGIC ---
        // console.time("⏳ TIMER 4: Auto-Delete Old Data");
        // const [cutoffResult] = await connection.query(`
        //     -- Temporary for testing: INTERVAL 10 DAY (Change back to INTERVAL 3 MONTH for production)
        //     SELECT DATE_SUB(MAX(DATE(shipment_date)), INTERVAL 10 DAY) as cutoff_date 
        //     FROM afs_data 
        //     WHERE shipment_date IS NOT NULL AND shipment_date != ''
        // `);

        const [cutoffResult] = await connection.query(`
            SELECT DATE_SUB(MAX(DATE(shipment_date)), INTERVAL 4 MONTH) as cutoff_date 
            FROM afs_data 
            WHERE shipment_date IS NOT NULL AND shipment_date != ''
        `);

        let deletedOldRecords = 0;
        if (cutoffResult.length > 0 && cutoffResult[0].cutoff_date) {
            const cutoffDate = cutoffResult[0].cutoff_date;
            const [deleteResult] = await connection.query(`
                DELETE FROM afs_data 
                WHERE shipment_date IS NOT NULL AND shipment_date != '' 
                AND DATE(shipment_date) < ?
            `, [cutoffDate]);
            deletedOldRecords = deleteResult.affectedRows;
            console.log(`🗑️ Auto-deleted ${deletedOldRecords} old records before cutoff date: ${cutoffDate}`);
        }
        console.timeEnd("⏳ TIMER 4: Auto-Delete Old Data");

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
const businessColumnMap = {
    parent_asin: "(Parent) ASIN",
    child_asin: "(Child) ASIN",
    title: "Title",
    sku: "SKU",
    units_ordered: "Units Ordered",
    units_ordered_b2b: "Units Ordered - B2B",
    unit_session_percentage: "Unit Session Percentage",
    unit_session_percentage_b2b: "Unit Session Percentage - B2B",
    ordered_product_sales: "Ordered Product Sales",
    ordered_product_sales_b2b: "Ordered Product Sales - B2B",
    total_order_items: "Total Order Items",
    total_order_items_b2b: "Total Order Items - B2B"
};

// Helper Function: String me se commas, currency symbols aur % hatane ke liye (No Changes Here)
const sanitizeNumber = (val, isFloat = false) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    let str = typeof val === 'object' ? (val.result !== undefined ? val.result.toString() : '') : val.toString();
    let cleanStr = str.replace(/[%₹,]/g, '').trim();
    if (cleanStr === '' || isNaN(cleanStr)) return 0;
    return isFloat ? parseFloat(cleanStr) : parseInt(cleanStr, 10);
};

// Helper Function: Excel serial date (jaise 46215) ko YYYY-MM-DD string mein convert karne ke liye
const parseExcelDate = (val) => {
    if (!val) return null;

    // Agar val pehle se hi ek Date object hai
    if (val instanceof Date) {
        return val.toISOString().split('T')[0];
    }

    // Agar val koi object hai jisme result hai
    if (typeof val === 'object' && val.result !== undefined) {
        val = val.result;
    }

    // Agar numeric serial hai (jaise 46215)
    const serial = Number(val);
    if (!isNaN(serial) && serial > 20000 && serial < 100000) {
        // Excel epoch starts at Jan 1, 1900. (using 25569 as offset to UNIX epoch)
        // Note: 86400 * 1000 = 86400000 milliseconds in a day
        const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0];
    }

    // Fallback: agar string ke form me normal date hai (e.g. "2026-07-12")
    return val.toString().trim();
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

        const marketplace_id = req.body.marketplace_id || null;
        
        // 1. Master report table mein Business entry create karein
        const [masterResult] = await connection.query(
            `INSERT INTO uploaded_reports (file_name, report_type, file_size, status, marketplace_id)
             VALUES (?, 'Business', ?, 'Processing', ?)`,
            [req.file.filename, fileSizeMB, marketplace_id]
        );
        reportId = masterResult.insertId;

        console.time("⏳ TIMER 1: Business File Parsing Time");
        let rawData = [];

        if (fileExt === '.csv') {
            rawData = await parseCsv(req.file.path);
        } else {
            // Super-fast stream reader
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

        // 🚨 DYNAMIC STRICT VALIDATION: (Map se automatic dhoondhega)
        const firstRowKeys = Object.keys(rawData[0]);
        const expectedAsinHeader = businessColumnMap.parent_asin; // e.g. "(Parent) ASIN"
        const expectedUnitsHeader = businessColumnMap.units_ordered; // e.g. "Units Ordered"

        if (!firstRowKeys.includes(expectedAsinHeader) && !firstRowKeys.includes(expectedUnitsHeader)) {
            throw new Error(`Mismatched Report! File me '${expectedAsinHeader}' ya '${expectedUnitsHeader}' column nahi mila. Please sahi file upload karein.`);
        }

        console.time("⏳ TIMER 2: Business Data Preparation Time");
        const bulkValues = [];

        // Map keys nikalne ke liye
        const dbColumns = Object.keys(businessColumnMap);

        // Ye arrays batayengi kis column ko Number ya Float (Decimal) banana hai
        const floatColumns = ['unit_session_percentage', 'unit_session_percentage_b2b', 'ordered_product_sales', 'ordered_product_sales_b2b'];
        const intColumns = ['units_ordered', 'units_ordered_b2b', 'total_order_items', 'total_order_items_b2b'];

        rawData.forEach((row) => {
            const rowValues = [reportId];
            let hasValidSkuOrAsin = false;

            // Database columns ke sequence ke mutabik file se value nikalenge
            dbColumns.forEach((dbCol) => {
                const excelHeader = businessColumnMap[dbCol];
                let cellValue = row[excelHeader];

                // 🚀 SMART PARSING: Agar column numeric hai, to sanitizeNumber use karein
                if (floatColumns.includes(dbCol)) {
                    cellValue = sanitizeNumber(cellValue, true);
                } else if (intColumns.includes(dbCol)) {
                    cellValue = sanitizeNumber(cellValue, false);
                } else {
                    cellValue = cellValue !== undefined ? cellValue : null;
                }

                rowValues.push(cellValue);

                // Validation: Sirf wahi rows insert karenge jisme SKU ya Child ASIN ho
                if ((dbCol === 'sku' || dbCol === 'child_asin') && cellValue) {
                    hasValidSkuOrAsin = true;
                }
            });

            if (hasValidSkuOrAsin) {
                bulkValues.push(rowValues);
            }
        });
        console.timeEnd("⏳ TIMER 2: Business Data Preparation Time");

        console.time("⏳ TIMER 3: Business Database Insertion Time");

        // 🚀 DYNAMIC INSERT QUERY (Aapke Map ke columns ke hisab se generate hogi)
        const insertQuery = `INSERT INTO business_data (report_id, ${dbColumns.join(', ')}) VALUES ?`;

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

        // --- 🗑️ AUTO DELETE PREVIOUS DIH REPORT ---
        console.time("⏳ TIMER 0: Delete Old DIH Report");
        const [oldDihReports] = await connection.query(`SELECT id, file_name FROM uploaded_reports WHERE report_type = 'DIH'`);
        if (oldDihReports.length > 0) {
            const oldIds = oldDihReports.map(r => r.id);
            
            // Delete files from storage
            oldDihReports.forEach((report) => {
                const oldFilePath = path.join(__dirname, "../../client/public/upload", report.file_name);
                if (fs.existsSync(oldFilePath)) {
                    try {
                        fs.unlinkSync(oldFilePath);
                    } catch(err) {
                        console.error("Failed to delete old DIH file:", err);
                    }
                }
            });

            // Delete from database (Cascade will automatically delete from dih_data)
            await connection.query(`DELETE FROM uploaded_reports WHERE id IN (?)`, [oldIds]);
            console.log(`🗑️ Deleted ${oldDihReports.length} old DIH reports before uploading new one.`);
        }
        console.timeEnd("⏳ TIMER 0: Delete Old DIH Report");

        const marketplace_id = req.body.marketplace_id || null;

        // Master table mein DIH ki entry
        const [masterResult] = await connection.query(
            `INSERT INTO uploaded_reports (file_name, report_type, file_size, status, marketplace_id)
             VALUES (?, 'DIH', ?, 'Processing', ?)`,
            [req.file.filename, fileSizeMB, marketplace_id]
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
            const reportDate = parseExcelDate(row["Date"]) || null;
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
            `SELECT r.id, r.file_name, r.report_type, r.file_size, r.status, r.uploaded_at, m.name as marketplace 
             FROM uploaded_reports r
             LEFT JOIN marketplaces m ON r.marketplace_id = m.id
             ORDER BY r.uploaded_at DESC 
             `
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

        const marketplace_id = req.body.marketplace_id || null;

        // 1. Master table mein Transit Shipment ki entry
        const [masterResult] = await connection.query(
            `INSERT INTO uploaded_reports (file_name, report_type, file_size, status, marketplace_id)
             VALUES (?, 'Transit Shipment', ?, 'Processing', ?)`,
            [req.file.filename, fileSizeMB, marketplace_id]
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

        // --- 🗑️ AUTO DELETE 4-MONTH OLD TRANSIT REPORTS ---
        console.time("⏳ TIMER 4: Auto-Delete Old Transit Reports");
        const [oldTransitReports] = await connection.query(`
            SELECT id, file_name 
            FROM uploaded_reports 
            WHERE report_type = 'Transit Shipment' 
            AND uploaded_at < DATE_SUB(NOW(), INTERVAL 4 MONTH)
        `);
        
        if (oldTransitReports.length > 0) {
            const oldIds = oldTransitReports.map(r => r.id);
            // Delete physical files
            oldTransitReports.forEach((report) => {
                const oldFilePath = path.join(__dirname, "../../client/public/upload", report.file_name);
                if (fs.existsSync(oldFilePath)) {
                    try { fs.unlinkSync(oldFilePath); } catch(err) { console.error("Failed to delete old Transit file:", err); }
                }
            });
            // Delete from database (Cascade deletes data)
            await connection.query(`DELETE FROM uploaded_reports WHERE id IN (?)`, [oldIds]);
            console.log(`🗑️ Deleted ${oldTransitReports.length} old Transit reports (> 4 months).`);
        }
        console.timeEnd("⏳ TIMER 4: Auto-Delete Old Transit Reports");

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

// Backend controller me
const getAllReports = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT r.*, m.name as marketplace 
            FROM uploaded_reports r
            LEFT JOIN marketplaces m ON r.marketplace_id = m.id
            ORDER BY r.uploaded_at DESC
        `);
        res.json({ data: rows });
    } catch (error) {
        res.status(500).json({ message: "Error fetching all reports" });
    }
};


// Naya function: headers peek karne ke liye
const peekHeaders = async (filePath, fileExt) => {
    let sheetHeaders = [];
    if (fileExt === '.csv') {
        const rawRows = await parseCsvRaw(filePath);
        for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
            const row = rawRows[i];
            if (row && row.length > 0) {
                sheetHeaders = sheetHeaders.concat(row.map(c => c ? c.toString().trim().toLowerCase() : ''));
            }
        }
    } else {
        const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
            styles: 'ignore', sharedStrings: 'cache', hyperlinks: 'ignore', worksheets: 'emit'
        });
        for await (const worksheet of workbookReader) {
            let rowCount = 0;
            for await (const row of worksheet) {
                if (!row.hasValues) continue;
                row.eachCell({ includeEmpty: true }, (cell) => {
                    let val = cell.value ? cell.value.toString().trim().toLowerCase() : '';
                    if (val) sheetHeaders.push(val);
                });
                rowCount++;
                if (rowCount > 10) break;
            }
            break;
        }
    }
    return sheetHeaders;
};

const autoUploadReport = async (req, res) => {
    try {
        if (!req.file) {
            return errorResponse(res, "Please upload a file", 400);
        }

        const fileExt = path.extname(req.file.originalname).toLowerCase();
        const headers = await peekHeaders(req.file.path, fileExt);
        const headersStr = headers.join(" ");

        if (headersStr.includes("amazon order id") || headersStr.includes("merchant order id")) {
            return await uploadAFSReport(req, res);
        } else if (headersStr.includes("(parent) asin") || headersStr.includes("units ordered")) {
            return await uploadBusinessReport(req, res);
        } else if (headersStr.includes("starting warehouse balance") || headersStr.includes("fnsku")) {
            return await uploadDIHReport(req, res);
        } else if (headersStr.includes("default prep owner") || (headersStr.includes("merchant sku") && headersStr.includes("fc") && headersStr.includes("quantity"))) {
            return await uploadTransitShipmentReport(req, res);
        } else {
            // Agar file pehchan me nahi aayi, usko server se delete kar do
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return errorResponse(res, "Could not detect report type from file headers. Please ensure it is a valid AFS, Business, DIH, or Transit report.", 400);
        }
    } catch (error) {
        console.error("Auto Upload Error:", error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        return errorResponse(res, "Failed to process auto upload", 500);
    }
};

// Module exports ko update karna mat bhoolna
module.exports = {
    uploadAFSReport,
    uploadBusinessReport,
    uploadDIHReport,
    getRecentUploads,
    deleteReport,
    uploadTransitShipmentReport,
    getAllReports,
    autoUploadReport
};