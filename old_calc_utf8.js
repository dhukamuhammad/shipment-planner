const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const ExcelJS = require("exceljs");
const db = require("../../config/db");
const { successResponse, errorResponse } = require("../../utils/responseFormatter");

// Helper: Sanitize Numbers
const sanitizeNumber = (val, isFloat = false) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    let str = typeof val === 'object' ? (val.result !== undefined ? val.result.toString() : '') : val.toString();
    let cleanStr = str.replace(/[%₹,]/g, '').trim();
    if (cleanStr === '' || isNaN(cleanStr)) return 0;
    return isFloat ? parseFloat(cleanStr) : parseInt(cleanStr, 10);
};

// Naya function - Raw array padhne ke liye (For CSV)
const parseCsvRaw = (filePath) => {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv({ headers: false })) // headers: false se array return hoga
            .on('data', (data) => results.push(Object.values(data)))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
};

// =======================================================
// 1. UPLOAD CALCULATION REPORT (CSV / XLSX)
// =======================================================
const uploadCalculationReport = async (req, res) => {
    const connection = await db.getConnection();
    let reportId = null;

    try {
        if (!req.file) return errorResponse(res, "Please upload a file", 400);

        const totalStartTime = Date.now();
        await connection.beginTransaction();

        const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2) + " MB";
        const fileExt = path.extname(req.file.originalname).toLowerCase();

        // 1. Create entry in uploaded_reports (For history tracking)
        const [reportResult] = await connection.query(
            `INSERT INTO uploaded_reports (file_name, report_type, file_size, status) VALUES (?, 'Calculation', ?, 'Processing')`,
            [req.file.filename, fileSizeMB]
        );
        reportId = reportResult.insertId;

        // 2. Create Master entry for Top Cards
        const [masterResult] = await connection.query(
            `INSERT INTO shipment_calculations_master (report_id, status) VALUES (?, 'Draft')`,
            [reportId] // <--- Yahan reportId pass kiya
        );
        const planId = masterResult.insertId;

        console.time("⏳ Calculation File Parsing");

        let rawRows = [];

        // --- STEP 1: POORI SHEET KO 2D ARRAY ME CONVERT KARO ---
        if (fileExt === '.csv') {
            rawRows = await parseCsvRaw(req.file.path);
        } else {
            const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(req.file.path, {
                styles: 'ignore', sharedStrings: 'cache', hyperlinks: 'ignore', worksheets: 'emit'
            });
            for await (const worksheet of workbookReader) {
                for await (const row of worksheet) {
                    if (!row.hasValues) continue;
                    let rowData = [];
                    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        let val = cell.value;
                        if (val && typeof val === 'object') {
                            val = val.result !== undefined ? val.result : cell.text;
                        }
                        rowData[colNumber] = val !== undefined ? val : null;
                    });
                    rawRows.push(rowData);
                }
                break; // Only read the first sheet
            }
        }
        console.timeEnd("⏳ Calculation File Parsing");

        if (rawRows.length === 0) throw new Error("File is empty!");

        // --- STEP 2: SMART SCANNER (Find Master Data & Header Row) ---
        console.time("⏳ Calculation Smart Scan & Prep");

        let globalAfsDays = 30, globalPlanDays = 50, globalBunchQty = 2, globalToShip = 0;
        let headerRowIndex = -1;
        let sheetHeaders = [];
        let headerTracker = {};

        for (let i = 0; i < rawRows.length; i++) {
            const currentRow = rawRows[i];
            if (!currentRow) continue;

            // Check karo agar is row me "Group Name" ya "SKU" likha hai 
            const isHeader = currentRow.some(cell => cell && cell.toString().toLowerCase().includes("group name"));

            if (isHeader) {
                headerRowIndex = i;
                // Headers map karo (Aur duplicate SKU/Title ko SKU_2, Title_2 banao)
                currentRow.forEach((cell, colNumber) => {
                    if (!cell) return;
                    let headerName = cell.toString().trim();
                    if (headerTracker[headerName]) {
                        sheetHeaders[colNumber] = `${headerName}_2`;
                    } else {
                        sheetHeaders[colNumber] = headerName;
                        headerTracker[headerName] = 1;
                    }
                });
                break; // Header mil gaya, ab aage scan mat karo
            } else {
                // Agar Header nahi hai, iska matlab ye Row 1 ya 2 (Master Data) hai
                currentRow.forEach((cell, idx) => {
                    if (cell) {
                        const txt = cell.toString().trim().toLowerCase();

                        // Check side cell or bottom cell for numbers
                        let valRight = currentRow[idx + 1] ? sanitizeNumber(currentRow[idx + 1]) : 0;
                        let valBelow = (rawRows[i + 1] && rawRows[i + 1][idx]) ? sanitizeNumber(rawRows[i + 1][idx]) : 0;
                        let finalVal = valRight > 0 ? valRight : valBelow;

                        if (txt.includes("afs days")) globalAfsDays = finalVal || globalAfsDays;
                        if (txt.includes("shipment plan")) globalPlanDays = finalVal || globalPlanDays;
                        if (txt.includes("bunch qty")) globalBunchQty = finalVal || globalBunchQty;
                        if (txt === "to ship" || txt.includes("to ship")) globalToShip = finalVal || globalToShip;
                    }
                });
            }
        }

        if (headerRowIndex === -1) {
            throw new Error("Invalid file! 'Group Name' ya 'SKU' header nahi mila. Please format check karein.");
        }

        // --- STEP 3: EXTRACT ACTUAL DATA ---
        let rawData = [];
        for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
            let obj = {};
            sheetHeaders.forEach((header, index) => {
                if (header) {
                    obj[header] = rawRows[i][index] !== undefined ? rawRows[i][index] : null;
                }
            });
            // Agar row me SKU hai tabhi usko list me daalo (ignore empty rows)
            if (obj["SKU"]) {
                rawData.push(obj);
            }
        }

        // --- STEP 4: PREPARE BULK VALUES FOR DB ---
        const bulkValues = [];
        rawData.forEach((row) => {
            bulkValues.push([
                planId,
                reportId,
                row["Group Name"] || 'Unknown',
                row["SKU"],
                row["Title"] || null,
                row["Category"] || null,

                sanitizeNumber(row["Int – WH"]),
                sanitizeNumber(row["Dec – WH"]),
                sanitizeNumber(row["Non Apron Qty"]),

                sanitizeNumber(row["APR- Sky Blue"]),
                sanitizeNumber(row["APR- Dark Blue"]),
                sanitizeNumber(row["APR- Brown"]),
                sanitizeNumber(row["APR- Green"]),
                sanitizeNumber(row["APR- Tan"]),
                sanitizeNumber(row["APR- Black"]),
                sanitizeNumber(row["APR- Red"]),
                sanitizeNumber(row["APR- Grey"]),

                sanitizeNumber(row["weight"], true),
                sanitizeNumber(row["Total Weight"], true),
                row["HSN"] ? row["HSN"].toString() : null,
                row["GST"] ? row["GST"].toString() : null,
                sanitizeNumber(row["COST"], true),

                row["SKU_2"] || null,   // Duplicate SKU logic applied above
                row["Title_2"] || null, // Duplicate Title logic applied above
                sanitizeNumber(row["Tra. Qty"]),
                sanitizeNumber(row["quantity"]),
                sanitizeNumber(row["Available Qty"]),
                row["Fulfilment ID"] || null,

                sanitizeNumber(row["Sale-Total"]),
                sanitizeNumber(row["Sale-WH"]),
                sanitizeNumber(row["Ship – WH"]),
                sanitizeNumber(row["Sum"]),
                sanitizeNumber(row["Final – WH"])
            ]);
        });
        console.timeEnd("⏳ Calculation Smart Scan & Prep");

        console.time("⏳ Calculation DB Insert");

        // Master Table me AFS Days etc. Update karo
        await connection.query(
            `UPDATE shipment_calculations_master SET afs_days=?, shipment_plan_days=?, bunch_qty=?, to_ship_qty=? WHERE id=?`,
            [globalAfsDays, globalPlanDays, globalBunchQty, globalToShip, planId]
        );

        // Bulk Insert 119+ rows
        const insertQuery = `
            INSERT INTO shipment_calculation_items (
                plan_id, report_id, group_name, sku, title, category, 
                int_wh, dec_wh, non_apron_qty, 
                apr_sky_blue, apr_dark_blue, apr_brown, apr_green, apr_tan, apr_black, apr_red, apr_grey, 
                weight, total_weight, hsn, gst, cost, 
                ref_sku, ref_title, tra_qty, quantity, available_qty, fulfilment_id, 
                sale_total, sale_wh, ship_wh, sum_val, final_wh
            ) VALUES ?
        `;

        const CHUNK_SIZE = 500;
        for (let i = 0; i < bulkValues.length; i += CHUNK_SIZE) {
            const chunk = bulkValues.slice(i, i + CHUNK_SIZE);
            await connection.query(insertQuery, [chunk]);
        }
        console.timeEnd("⏳ Calculation DB Insert");

        await connection.query(`UPDATE uploaded_reports SET status = 'Success' WHERE id = ?`, [reportId]);

        await connection.commit();
        connection.release();

        const timeTaken = ((Date.now() - totalStartTime) / 1000).toFixed(2);
        return successResponse(res, "Calculation Sheet Uploaded Successfully!", {
            reportId, planId, totalRecordsInserted: bulkValues.length, timeTaken: `${timeTaken}s`
        }, 201);

    } catch (error) {
        console.error("Calculation Upload Error:", error);
        if (connection) {
            await connection.rollback();
            if (reportId) await connection.query(`UPDATE uploaded_reports SET status = 'Failed' WHERE id = ?`, [reportId]);
            connection.release();
        }
        return errorResponse(res, error.message || "Failed to process Calculation report", 500);
    }
};

// =======================================================
// 2. MANUAL ADD SINGLE SKU ROW (Smart Insert with Weight)
// =======================================================
const addManualCalculationRow = async (req, res) => {
    let connection;
    try {
        const data = req.body;

        if (!data.planId || !data.sku || !data.groupName) {
            return errorResponse(res, "Plan ID, Group Name and SKU are required!", 400);
        }

        connection = await db.getConnection();

        const [masterRes] = await connection.query(`SELECT report_id FROM shipment_calculations_master WHERE id = ?`, [data.planId]);
        const reportId = masterRes.length > 0 ? masterRes[0].report_id : null;

        // 🔥 Weight column add kar di gayi hai
        const insertQuery = `
            INSERT INTO shipment_calculation_items (
                plan_id, report_id, group_name, sku, title, category, 
                hsn, gst, cost, weight,
                ref_sku, ref_title, fulfilment_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const fcId = 'BLR4';

        await connection.query(insertQuery, [
            data.planId, reportId, data.groupName, data.sku, data.title || null, data.category || null,
            data.hsn || null, data.gst || null, data.cost || 0, data.weight || 0, // 🔥 data.weight add kiya
            data.sku, data.title || null, fcId
        ]);

        connection.release();
        return successResponse(res, "SKU row added successfully!", null, 201);
    } catch (error) {
        console.error("Add Manual Row Error:", error);
        if (connection) connection.release();
        return errorResponse(res, "Failed to add manual row", 500);
    }
};

// =======================================================
// 7. EDIT CALCULATION ROW (With Weight)
// =======================================================
const editCalculationRow = async (req, res) => {
    try {
        // 🔥 weight destructure kiya
        const { itemId, groupName, sku, title, category, hsn, gst, cost, weight } = req.body;
        const connection = await db.getConnection();

        await connection.query(
            `UPDATE shipment_calculation_items 
             SET group_name=?, sku=?, title=?, category=?, hsn=?, gst=?, cost=?, weight=?, ref_sku=?, ref_title=?
             WHERE id=?`,
            [groupName, sku, title, category, hsn, gst, cost, weight, sku, title, itemId] // 🔥 weight variable map kiya
        );
        connection.release();
        return successResponse(res, "Row updated successfully!", null, 200);
    } catch (error) {
        console.error("Edit Row Error:", error);
        return errorResponse(res, "Failed to edit row", 500);
    }
};

// =======================================================
// 8. DELETE CALCULATION ROW
// =======================================================
const deleteCalculationRow = async (req, res) => {
    try {
        const { itemId } = req.params; // ID URL param se aayegi
        const connection = await db.getConnection();

        await connection.query(`DELETE FROM shipment_calculation_items WHERE id=?`, [itemId]);
        connection.release();
        return successResponse(res, "Row deleted successfully!", null, 200);
    } catch (error) {
        console.error("Delete Row Error:", error);
        return errorResponse(res, "Failed to delete row", 500);
    }
};

// module.exports me editCalculationRow, deleteCalculationRow zaroor add karein.

// =======================================================
// 3. GET CALCULATION DATA (Master & Items)
// =======================================================
const getCalculationData = async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();

        // Sabse recent master plan (top cards data) nikal rahe hain
        const [masterRows] = await connection.query(
            `SELECT * FROM shipment_calculations_master ORDER BY created_at DESC LIMIT 1`
        );

        if (masterRows.length === 0) {
            connection.release();
            return successResponse(res, "No data found", { master: null, items: [] }, 200);
        }

        const masterData = masterRows[0];

        // Master ID ke basis par saari SKUs (rows) nikal rahe hain
        const [itemRows] = await connection.query(
            `SELECT * FROM shipment_calculation_items WHERE plan_id = ?`,
            [masterData.id]
        );

        // Transit Shipment report se SKU-wise total quantity nikal rahe hain (Tra. Qty ke liye)
        const [transitRows] = await connection.query(
            `SELECT merchant_sku, SUM(quantity) as total_qty FROM transit_shipment_data GROUP BY merchant_sku`
        );
        const transitQtyMap = {};
        transitRows.forEach((r) => {
            transitQtyMap[r.merchant_sku] = r.total_qty;
        });

        // DIH report se SKU-wise total Ending Warehouse Balance nikal rahe hain (Quantity column ke liye)
        const [dihRows] = await connection.query(
            `SELECT msku, SUM(ending_warehouse_balance) as total_ending_balance FROM dih_data GROUP BY msku`
        );
        const dihQtyMap = {};
        dihRows.forEach((r) => {
            dihQtyMap[r.msku] = r.total_ending_balance;
        });

        // Business report se SKU-wise total Units Ordered nikal rahe hain (Sale-Total ke liye)
        const [businessRows] = await connection.query(
            `SELECT sku, SUM(units_ordered) as total_units_ordered FROM business_data GROUP BY sku`
        );
        const businessQtyMap = {};
        businessRows.forEach((r) => {
            businessQtyMap[r.sku] = r.total_units_ordered;
        });

        // AFS report se SKU-wise total Shipped Quantity nikal rahe hain (Sale-WH ke liye)
        const [afsRows] = await connection.query(
            `SELECT merchant_sku, SUM(shipped_quantity) as total_shipped_qty FROM afs_data GROUP BY merchant_sku`
        );
        const afsQtyMap = {};
        afsRows.forEach((r) => {
            afsQtyMap[r.merchant_sku] = r.total_shipped_qty;
        });

        // Master ke afs_days aur shipment_plan_days nikal rahe hain (Ship-WH formula ke liye)
        const afsDays = Number(masterData.afs_days) || 0;
        const shipmentPlanDays = Number(masterData.shipment_plan_days) || 0;

        // Har item ke tra_qty, quantity, sale_total, sale_wh, ship_wh ko calculate karke overwrite kar rahe hain
        const itemsWithTraQty = itemRows.map((item) => {
            const traQty = Number(transitQtyMap[item.sku]) || 0;
            const quantity = Number(dihQtyMap[item.sku]) || 0;
            const saleWh = Number(afsQtyMap[item.sku]) || 0;

            // Available Qty = Tra. Qty + Quantity
            const availableQty = traQty + quantity;

            // Formula: Ship-WH = (Sale-WH / AFS Days * Shipment Plan Days) - Available Qty
            let shipWh = 0;
            if (afsDays > 0) {
                shipWh = ((saleWh / afsDays) * shipmentPlanDays) - availableQty;
            }

            return {
                ...item,
                tra_qty: traQty,
                quantity: quantity,
                sale_total: businessQtyMap[item.sku] || 0,
                sale_wh: saleWh,
                available_qty: availableQty,
                ship_wh: Math.round(shipWh)
            };
        });

        connection.release();

        return successResponse(res, "Data fetched successfully", {
            master: masterData,
            items: itemsWithTraQty
        }, 200);

    } catch (error) {
        console.error("Fetch Calculation Data Error:", error);
        if (connection) connection.release();
        return errorResponse(res, "Failed to fetch calculation data", 500);
    }
};

// =======================================================
// 4. INLINE EDIT (AUTO-SAVE) FOR MASTER DATA
// =======================================================
const updateMasterData = async (req, res) => {
    try {
        const { planId, field, value } = req.body;

        if (!planId || !field) {
            return errorResponse(res, "Plan ID and Field name are required", 400);
        }

        // Security check: Sirf allowed columns hi update ho sakein
        const validFields = ['afs_days', 'shipment_plan_days', 'bunch_qty'];
        if (!validFields.includes(field)) {
            return errorResponse(res, "Invalid field name", 400);
        }

        const connection = await db.getConnection();

        // Dynamic query to update specific field
        await connection.query(
            `UPDATE shipment_calculations_master SET ${field} = ? WHERE id = ?`,
            [value, planId]
        );
        connection.release();

        return successResponse(res, "Value auto-saved successfully!", null, 200);
    } catch (error) {
        console.error("Auto-save Error:", error);
        return errorResponse(res, "Failed to auto-save data", 500);
    }
};

// =======================================================
// 5. UPDATE ITEM FINAL WH (MANUAL OVERRIDE)
// =======================================================
const updateItemFinalWh = async (req, res) => {
    try {
        const { itemId, finalWh } = req.body;
        const connection = await db.getConnection();

        // Value update karo aur flag ko 1 (true) kar do
        await connection.query(
            `UPDATE shipment_calculation_items SET final_wh = ?, is_manual_final_wh = 1 WHERE id = ?`,
            [finalWh, itemId]
        );
        connection.release();
        return successResponse(res, "Final WH manually updated!", null, 200);
    } catch (error) {
        console.error("Manual Item Update Error:", error);
        return errorResponse(res, "Failed to update Final WH", 500);
    }
};

// =======================================================
// 6. RESET ALL TO FORMULA
// =======================================================
const resetFinalWh = async (req, res) => {
    try {
        const { planId } = req.body;
        const connection = await db.getConnection();

        // Plan ki saari rows ka manual flag hata do (0 kar do)
        await connection.query(
            `UPDATE shipment_calculation_items SET is_manual_final_wh = 0 WHERE plan_id = ?`,
            [planId]
        );
        connection.release();
        return successResponse(res, "Calculations reset to formula!", null, 200);
    } catch (error) {
        console.error("Reset Error:", error);
        return errorResponse(res, "Failed to reset calculations", 500);
    }
};

// =======================================================
// 7. GET MANIFEST DETAILS (HSN/GST/Declared Value by SKU list)
// =======================================================
const getManifestDetails = async (req, res) => {
    try {
        const { skus } = req.query; // comma-separated SKU list
        // if (!skus) return errorResponse(res, "SKUs are required", 400);

        const skuList = skus.split(',').map(s => s.trim()).filter(Boolean);
        if (skuList.length === 0) return successResponse(res, "No SKUs provided", [], 200);

        const connection = await db.getConnection();
        const placeholders = skuList.map(() => '?').join(',');

        const [rows] = await connection.query(
            `SELECT merchant_sku, 
                    MAX(hsn_sac_code) as hsn_sac_code, 
                    MAX(gst_rate) as gst_rate, 
                    MAX(declared_value_per_unit) as declared_value_per_unit,
                    MAX(fc) as fc
             FROM transit_shipment_data 
             WHERE merchant_sku IN (${placeholders}) 
             GROUP BY merchant_sku`,
            skuList
        );
        connection.release();

        return successResponse(res, "Manifest details fetched successfully", rows, 200);
    } catch (error) {
        console.error("Get Manifest Details Error:", error);
        return errorResponse(res, "Failed to fetch manifest details", 500);
    }
};

module.exports = {
    uploadCalculationReport,
    addManualCalculationRow,
    editCalculationRow,
    deleteCalculationRow,
    getCalculationData,
    updateMasterData,
    updateItemFinalWh,
    resetFinalWh,
    getManifestDetails
};
