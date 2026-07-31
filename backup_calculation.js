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

        const marketplace_id = req.body.marketplace_id || null;

        // 1. Create entry in uploaded_reports (For history tracking)
        const [reportResult] = await connection.query(
            `INSERT INTO uploaded_reports (file_name, report_type, file_size, status, marketplace_id) VALUES (?, 'Calculation', ?, 'Processing', ?)`,
            [req.file.filename, fileSizeMB, marketplace_id]
        );
        reportId = reportResult.insertId;

        // 2. Check if appending to an existing plan
        let planId = req.body.planId;
        
        if (!planId) {
            // Create Master entry for Top Cards
            const [masterResult] = await connection.query(
                `INSERT INTO shipment_calculations_master (report_id, status, marketplace_id) VALUES (?, 'Draft', ?)`,
                [reportId, marketplace_id] // <--- Yahan reportId pass kiya
            );
            planId = masterResult.insertId;
        }

        console.time("⏳ Calculation File Parsing");

        let rawRows = [];

        // --- STEP 1: POORI SHEET KO 2D ARRAY ME CONVERT KARO ---
        if (fileExt === '.csv') {
            rawRows = await parseCsvRaw(req.file.path);
        } else {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(req.file.path);
            const worksheet = workbook.worksheets[0];
            
            worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
                if (!row.hasValues) return;
                let rowData = [];
                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    let val = cell.value;
                    if (val && typeof val === 'object') {
                        val = val.result !== undefined ? val.result : cell.text;
                    }
                    rowData[colNumber] = val !== undefined ? val : null;
                });
                rawRows.push(rowData);
            });
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

        // --- STEP 3.5: DUPLICATE CHECK IN EXISTING PLAN ---
        if (req.body.planId) {
            const uploadedSkus = rawData.map(r => r["SKU"]);
            if (uploadedSkus.length > 0) {
                const [existingRows] = await connection.query(
                    `SELECT sku FROM shipment_calculation_items WHERE plan_id = ? AND sku IN (?)`,
                    [req.body.planId, uploadedSkus]
                );
                if (existingRows.length > 0) {
                    const dupSkus = existingRows.map(r => r.sku);
                    throw new Error(`${dupSkus.join(', ')} already exist`);
                }
            }
        }

        // --- STEP 4: PREPARE BULK VALUES FOR DB ---
        const bulkValues = [];
        rawData.forEach((row) => {
            let shipmentPackagingJSON = null;
            if (row["shipment_packaging"] && typeof row["shipment_packaging"] === 'string') {
                const parts = row["shipment_packaging"].split('|');
                const parsedPackaging = [];
                parts.forEach(part => {
                    const kv = part.split(':');
                    if (kv.length >= 2) {
                        const key = kv[0].trim();
                        const value = kv.slice(1).join(':').trim();
                        if (key && value) {
                            parsedPackaging.push({ key, value });
                        }
                    }
                });
                if (parsedPackaging.length > 0) {
                    shipmentPackagingJSON = JSON.stringify(parsedPackaging);
                }
            }

            bulkValues.push([
                planId,
                reportId,
                marketplace_id,
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

                sanitizeNumber(row["Weight"] || row["weight"], true),
                sanitizeNumber(row["Total Weight"], true),
                row["HSN"] ? row["HSN"].toString() : null,
                row["GST"] ? row["GST"].toString() : null,
                sanitizeNumber(row["Cost"] || row["COST"], true),

                row["SKU_2"] || row["SKU"],   // Duplicate SKU logic or fallback to SKU
                row["Title_2"] || row["Title"] || null, // Duplicate Title logic or fallback to Title
                sanitizeNumber(row["Tra. Qty"]),
                sanitizeNumber(row["quantity"]),
                sanitizeNumber(row["Available Qty"]),
                row["Fulfilment ID"] || 'BLR4',

                sanitizeNumber(row["Sale-Total"]),
                sanitizeNumber(row["Sale-WH"]),
                sanitizeNumber(row["Ship – WH"]),
                sanitizeNumber(row["Sum"]),
                sanitizeNumber(row["Final – WH"]),
                shipmentPackagingJSON,
                sanitizeNumber(row["MRP"], true),
                row["FNSKU"] || null,
                sanitizeNumber(row["Length (L)"] || row["length (l)"], true),
                sanitizeNumber(row["Width (W)"] || row["width (w)"], true),
                sanitizeNumber(row["Height (H)"] || row["height (h)"], true),
                row["Dimension Unit"] || row["dimension unit"] || 'cm'
            ]);
        });
        console.timeEnd("⏳ Calculation Smart Scan & Prep");

        console.time("⏳ Calculation DB Insert");

        // Master Table me AFS Days etc. Update karo (only for new plans)
        if (!req.body.planId) {
            await connection.query(
                `UPDATE shipment_calculations_master SET afs_days=?, shipment_plan_days=?, bunch_qty=?, to_ship_qty=? WHERE id=?`,
                [globalAfsDays, globalPlanDays, globalBunchQty, globalToShip, planId]
            );
        }

        // Bulk Insert 119+ rows
        const insertQuery = `
            INSERT INTO shipment_calculation_items (
                plan_id, report_id, marketplace_id, group_name, sku, title, category, 
                int_wh, dec_wh, non_apron_qty, 
                apr_sky_blue, apr_dark_blue, apr_brown, apr_green, apr_tan, apr_black, apr_red, apr_grey, 
                weight, total_weight, hsn, gst, cost, 
                ref_sku, ref_title, tra_qty, quantity, available_qty, fulfilment_id, 
                sale_total, sale_wh, ship_wh, sum_val, final_wh, shipment_packaging, mrp, fnsku,
                packing_dimension_length, packing_dimension_width, packing_dimension_height, packing_dimension_unit
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
// Helper to merge custom attributes arrays
function mergeAttributes(existingArr, newArr) {
    if (!existingArr) existingArr = [];
    if (!newArr) newArr = [];
    if (typeof existingArr === 'string') {
        try { existingArr = JSON.parse(existingArr); } catch(e) { existingArr = []; }
    }
    const map = new Map();
    existingArr.forEach(item => {
        if(item.key) map.set(item.key.trim(), item.value);
    });
    newArr.forEach(item => {
        if(item.key) map.set(item.key.trim(), item.value);
    });
    const merged = [];
    map.forEach((value, key) => merged.push({key, value}));
    return merged;
}

// Helper to get category attributes across all plans
async function getCategoryAttributes(connection, category) {
    if (!category) return [];
    const [rows] = await connection.query(
        `SELECT shipment_packaging FROM shipment_calculation_items WHERE category = ? AND shipment_packaging IS NOT NULL AND shipment_packaging != '[]' AND shipment_packaging != 'null' LIMIT 1`, 
        [category]
    );
    if (rows.length > 0 && rows[0].shipment_packaging) {
        try {
            return typeof rows[0].shipment_packaging === 'string' ? JSON.parse(rows[0].shipment_packaging) : rows[0].shipment_packaging;
        } catch(e) { return []; }
    }
    return [];
}

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

        // 🔥 Weight, mrp, fnsku column and shipment_packaging added
        const insertQuery = `
            INSERT INTO shipment_calculation_items (
                plan_id, report_id, group_name, sku, title, category, 
                hsn, gst, cost, weight, mrp, fnsku,
                ref_sku, ref_title, fulfilment_id, shipment_packaging,
                packing_dimension_length, packing_dimension_width, packing_dimension_height, packing_dimension_unit
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const fcId = 'BLR4';
        let finalAttrs = data.customAttributes || [];
        
        if (data.category) {
            const existingCatAttrs = await getCategoryAttributes(connection, data.category);
            finalAttrs = mergeAttributes(existingCatAttrs, finalAttrs);
        }

        const customAttrsStr = finalAttrs.length > 0 ? JSON.stringify(finalAttrs) : null;

        await connection.query(insertQuery, [
            data.planId, reportId, data.groupName, data.sku, data.title || null, data.category || null,
            data.hsn || null, data.gst || null, data.cost || 0, data.weight || 0, data.mrp || 0, data.fnsku || null,
            data.sku, data.title || null, fcId, customAttrsStr,
            data.packing_dimension_length || null, data.packing_dimension_width || null, data.packing_dimension_height || null, data.packing_dimension_unit || 'cm'
        ]);

        // Sync to all SKUs in this category across all plans
        if (data.category && customAttrsStr) {
            await connection.query(
                `UPDATE shipment_calculation_items SET shipment_packaging = ? WHERE category = ?`,
                [customAttrsStr, data.category]
            );
        }

        connection.release();
        return successResponse(res, "SKU row added successfully!", null, 201);
    } catch (error) {
        console.error("Add Manual Row Error:", error);
        if (connection) connection.release();
        return errorResponse(res, "Failed to add manual row", 500);
    }
};

// =======================================================
// 7. EDIT CALCULATION ROW (With Weight & Active Status)
// =======================================================
const editCalculationRow = async (req, res) => {
    try {
        const { itemId, groupName, sku, title, category, hsn, gst, cost, weight, mrp, fnsku, isActive, customAttributes, packing_dimension_length, packing_dimension_width, packing_dimension_height, packing_dimension_unit } = req.body;
        const connection = await db.getConnection();

        const [itemRows] = await connection.query(`SELECT category FROM shipment_calculation_items WHERE id=?`, [itemId]);
        const oldCategory = itemRows.length > 0 ? itemRows[0].category : null;

        let finalAttrsToSave = customAttributes || [];

        // If category changed, merge so we don't wipe the target category's existing attributes
        if (category && category !== oldCategory) {
            const existingCatAttrs = await getCategoryAttributes(connection, category);
            finalAttrsToSave = mergeAttributes(existingCatAttrs, finalAttrsToSave);
        }

        const customAttrsStr = finalAttrsToSave.length > 0 ? JSON.stringify(finalAttrsToSave) : null;

        await connection.query(
            `UPDATE shipment_calculation_items 
             SET group_name=?, sku=?, title=?, category=?, hsn=?, gst=?, cost=?, weight=?, mrp=?, fnsku=?, is_active=?, ref_sku=?, ref_title=?, shipment_packaging=?, packing_dimension_length=?, packing_dimension_width=?, packing_dimension_height=?, packing_dimension_unit=?
             WHERE id=?`,
            [groupName, sku, title, category, hsn, gst, cost, weight, mrp, fnsku, isActive !== undefined ? isActive : 1, sku, title, customAttrsStr, packing_dimension_length || null, packing_dimension_width || null, packing_dimension_height || null, packing_dimension_unit || 'cm', itemId]
        );

        // Sync to all SKUs in this category across all plans
        // Overwrites entirely if category didn't change (supports deletion)
        if (category) {
            await connection.query(
                `UPDATE shipment_calculation_items SET shipment_packaging = ? WHERE category = ?`,
                [customAttrsStr, category]
            );
        }

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
        const itemId = req.params.id; // ID URL param se aayegi
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
        const { marketplace_id, planId, date } = req.query;

        // Removed strict restriction to allow fetching the latest plan by default
        // if (!planId && (!marketplace_id || !date)) {
        //     return successResponse(res, "No data selected", { master: null, items: [] }, 200);
        // }

        connection = await db.getConnection();

        let masterQuery = `SELECT * FROM shipment_calculations_master WHERE 1=1`;
        let masterParams = [];

        if (planId) {
            masterQuery += ` AND id = ?`;
            masterParams.push(planId);
        } else if (marketplace_id && date) {
            masterQuery += ` AND marketplace_id = ? AND DATE(created_at) = ? AND is_deleted = 0`;
            masterParams.push(marketplace_id, date);
        } else if (marketplace_id) {
            masterQuery += ` AND marketplace_id = ? AND status = 'Draft' AND is_deleted = 0`;
            masterParams.push(marketplace_id);
        } else {
            masterQuery += ` AND status = 'Draft' AND is_deleted = 0`;
        }

        masterQuery += ` ORDER BY created_at DESC LIMIT 1`;

        const [masterRows] = await connection.query(masterQuery, masterParams);

        if (masterRows.length === 0) {
            // Agar koi Draft plan nahi mila, but marketplace provide kiya gaya hai (Upload page se aaya hai)
            if (!planId && (!date || date === "") && marketplace_id) {
                // Latest Completed plan check karo
                const [completedRows] = await connection.query(
                    `SELECT * FROM shipment_calculations_master WHERE marketplace_id = ? AND status = 'Completed' ORDER BY created_at DESC LIMIT 1`,
                    [marketplace_id]
                );

                if (completedRows.length > 0) {
                    const lastPlan = completedRows[0];
                    // Naya Draft plan create karo pichle data ke basis par
                    const [newMasterRes] = await connection.query(
                        `INSERT INTO shipment_calculations_master (report_id, status, marketplace_id, afs_days, shipment_plan_days, bunch_qty, to_ship_qty) 
                         VALUES (?, 'Draft', ?, ?, ?, ?, ?)`,
                        [lastPlan.report_id, lastPlan.marketplace_id, lastPlan.afs_days, lastPlan.shipment_plan_days, lastPlan.bunch_qty, lastPlan.to_ship_qty]
                    );
                    const newPlanId = newMasterRes.insertId;

                    // Purane plan ke saare items clone karke naye plan me daal do
                    await connection.query(
                        `INSERT INTO shipment_calculation_items (
                            plan_id, report_id, marketplace_id, group_name, sku, title, category, 
                            int_wh, dec_wh, non_apron_qty, 
                            apr_sky_blue, apr_dark_blue, apr_brown, apr_green, apr_tan, apr_black, apr_red, apr_grey, 
                            weight, total_weight, hsn, gst, cost, mrp, fnsku,
                            ref_sku, ref_title, tra_qty, quantity, available_qty, fulfilment_id, 
                            sale_total, sale_wh, ship_wh, sum_val, final_wh, is_active, shipment_packaging
                        )
                         SELECT 
                            ?, report_id, marketplace_id, group_name, sku, title, category, 
                            int_wh, dec_wh, non_apron_qty, 
                            apr_sky_blue, apr_dark_blue, apr_brown, apr_green, apr_tan, apr_black, apr_red, apr_grey, 
                            weight, total_weight, hsn, gst, cost, mrp, fnsku,
                            ref_sku, ref_title, tra_qty, quantity, available_qty, fulfilment_id, 
                            sale_total, sale_wh, ship_wh, sum_val, final_wh, is_active, shipment_packaging
                         FROM shipment_calculation_items WHERE plan_id = ?`,
                        [newPlanId, lastPlan.id]
                    );

                    // Naya plan fetch karke list me daal do
                    const [newMasterRows] = await connection.query(`SELECT * FROM shipment_calculations_master WHERE id = ?`, [newPlanId]);
                    masterRows.push(newMasterRows[0]);
                }
            }
        }

        if (masterRows.length === 0) {
            connection.release();
            return successResponse(res, "No data found", { master: null, items: [] }, 200);
        }

        const masterData = masterRows[0];

        let calculatedAfsDays = masterData.afs_days; // Default fallback

        // Master ID ke basis par saari SKUs (rows) nikal rahe hain
        const [itemRows] = await connection.query(
            `SELECT * FROM shipment_calculation_items WHERE plan_id = ?`,
            [masterData.id]
        );

        // --- BYPASS DYNAMIC CALCULATION FOR COMPLETED PLANS ---
        // Agar plan completed hai to purana freeze hua data bhej do
        if (masterData.status === 'Completed') {
            connection.release();
            return successResponse(res, "Data fetched successfully", {
                master: masterData,
                items: itemRows
            }, 200);
        }

        // --- SMART DATE MATCHING FOR TRANSIT SHIPMENT ---
        const [latestOtherReports] = await connection.query(`
            SELECT MAX(uploaded_at) as latest_other_time
            FROM uploaded_reports
            WHERE report_type IN ('AFS', 'Business', 'DIH') AND status = 'Success'
        `);

        const [latestTransitReport] = await connection.query(`
            SELECT id, uploaded_at FROM uploaded_reports WHERE report_type = 'Transit Shipment' AND status = 'Success' ORDER BY uploaded_at DESC LIMIT 1
        `);

        let latestTransitId = null;
        if (latestTransitReport.length > 0) {
            if (latestOtherReports.length > 0 && latestOtherReports[0].latest_other_time) {
                const otherTime = new Date(latestOtherReports[0].latest_other_time).getTime();
                const transitTime = new Date(latestTransitReport[0].uploaded_at).getTime();
                const hoursDiff = Math.abs(otherTime - transitTime) / (1000 * 60 * 60);
                // 12 hours window
                if (hoursDiff <= 12) {
                    latestTransitId = latestTransitReport[0].id;
                }
            } else {
                latestTransitId = latestTransitReport[0].id; // Fallback if no other reports exist
            }
        }

        let transitRows = [];
        if (latestTransitId) {
            [transitRows] = await connection.query(
                `SELECT merchant_sku, SUM(quantity) as total_qty FROM transit_shipment_data WHERE report_id = ? GROUP BY merchant_sku`,
                [latestTransitId]
            );
        }

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

        // Get latest DIH report ID for linking
        const [latestDihReport] = await connection.query(`
            SELECT id FROM uploaded_reports WHERE report_type = 'DIH' AND status = 'Success' AND marketplace_id = ? ORDER BY uploaded_at DESC LIMIT 1
        `, [masterData.marketplace_id]);
        const latestDihId = latestDihReport.length > 0 ? latestDihReport[0].id : null;

        // Business report se SKU-wise total Units Ordered nikal rahe hain (Sale-Total ke liye)
        const [businessRows] = await connection.query(
            `SELECT sku, SUM(units_ordered) as total_units_ordered FROM business_data GROUP BY sku`
        );
        const businessQtyMap = {};
        businessRows.forEach((r) => {
            businessQtyMap[r.sku] = r.total_units_ordered;
        });

        // --- Naya AFS Logic: Current Month aur 4-Month Avg ke liye ---

        // 1. Sabse pehle latest AFS report nikalte hain (Current Month 'Sale-WH' ke liye)
        const [latestAfsReport] = await connection.query(`
            SELECT report_id as id, MAX(shipment_date) as max_date 
            FROM afs_data 
            WHERE shipment_date IS NOT NULL AND shipment_date != ''
            GROUP BY report_id 
            ORDER BY max_date DESC 
            LIMIT 1
        `);

        let afsCurrentQtyMap = {};
        if (latestAfsReport.length > 0) {
            const latestAfsId = latestAfsReport[0].id;

            // --- NEW: Calculate afs_days dynamically from only the LATEST afs_data report ---
            const [afsDates] = await connection.query(
                `SELECT DATEDIFF(MAX(DATE(shipment_date)), MIN(DATE(shipment_date))) + 1 as total_days 
                 FROM afs_data 
                 WHERE shipment_date IS NOT NULL AND shipment_date != '' AND report_id = ?`,
                [latestAfsId]
            );

            if (afsDates.length > 0 && afsDates[0].total_days) {
                calculatedAfsDays = afsDates[0].total_days;
            }

            // Sirf latest report ka data (Current Sale-WH)
            const [afsCurrentRows] = await connection.query(
                `SELECT merchant_sku, SUM(shipped_quantity) as total_shipped_qty FROM afs_data WHERE report_id = ? GROUP BY merchant_sku`,
                [latestAfsId]
            );
            afsCurrentRows.forEach((r) => {
                afsCurrentQtyMap[r.merchant_sku] = r.total_shipped_qty;
            });
        }

        // Override the database value so frontend receives the exact calculated days
        masterData.afs_days = calculatedAfsDays;

        // 2. 4-Month ka Total aur Count nikalte hain (Avg ke liye)
        const [afsAvgRows] = await connection.query(
            `SELECT merchant_sku, SUM(shipped_quantity) as total_qty, COUNT(DISTINCT report_id) as month_count 
             FROM afs_data 
             GROUP BY merchant_sku`
        );
        const afsAvgQtyMap = {};
        afsAvgRows.forEach((r) => {
            const count = r.month_count > 0 ? r.month_count : 1;
            afsAvgQtyMap[r.merchant_sku] = r.total_qty / count;
        });

        // Master ke afs_days aur shipment_plan_days nikal rahe hain (Ship-WH formula ke liye)
        const afsDays = Number(masterData.afs_days) || 0;
        const shipmentPlanDays = Number(masterData.shipment_plan_days) || 0;

        // --- FETCH STOCK AVAILABILITY ---
        const [latestStockReport] = await connection.query(`
            SELECT id FROM uploaded_reports WHERE report_type = 'Stock' AND status = 'Success' AND marketplace_id = ? ORDER BY uploaded_at DESC LIMIT 1
        `, [masterData.marketplace_id]);
        
        const latestStockId = latestStockReport.length > 0 ? latestStockReport[0].id : null;
        let stockAvailableMap = {};
        if (latestStockId) {
            const [stockRows] = await connection.query(
                `SELECT group_name, SUM(available_qty) as total_available FROM stock_availability WHERE upload_id = ? GROUP BY group_name`,
                [latestStockId]
            );
            stockRows.forEach((r) => {
                if(r.group_name) {
                    stockAvailableMap[r.group_name.trim().toLowerCase()] = r.total_available;
                }
            });
        }

        // --- FETCH DYNAMIC EVENT MULTIPLIER ---
        let EVENT_MULTIPLIER = 1.0;
        const [eventRows] = await connection.query(`
            SELECT MAX(multiplier) as max_multiplier 
            FROM events_calendar 
            WHERE start_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY) 
            AND end_date >= CURDATE()
        `, [shipmentPlanDays]);

        if (eventRows.length > 0 && eventRows[0].max_multiplier) {
            EVENT_MULTIPLIER = parseFloat(eventRows[0].max_multiplier);
        }

        // Har item ke tra_qty, quantity, sale_total, sale_wh, sale_wh_avg, ship_wh ko calculate karke overwrite kar rahe hain

        // Configuration for Advanced Logic (1 to 9)
        // 8. Event / Festival Multiplier (Now dynamic from DB)
        // const EVENT_MULTIPLIER = 1.0; 
        const LEAD_TIME_DAYS = 7;     // 9. Dynamic Coverage (Supplier lead time)
        const OUT_OF_STOCK_DAYS = 0;  // 1. Stockout Correction (Mock value for out-of-stock days)
        const LISTING_AGE_DAYS = 100; // 2. Listing Age Filter (Mock value, >30 means old product)

        const bunchQty = Number(masterData.bunch_qty) || 0;

        // First Pass: Calculate basic values and group demands
        let groupDemandMap = {};
        
        let preliminaryItems = itemRows.map((item) => {
            const traQty = Number(transitQtyMap[item.sku]) || 0;
            const quantity = Number(dihQtyMap[item.sku]) || 0;
            const saleWh = Number(afsCurrentQtyMap[item.sku]) || 0;
            const saleWhAvg = Number(afsAvgQtyMap[item.sku]) || 0; // Historical 4-month total/avg

            // 6. Pipeline Inventory: Available = Transit (Pipeline) + Current Warehouse Stock
            const availableQty = traQty + quantity;

            let shipWh = 0;

            if (afsDays > 0) {
                shipWh = Math.ceil(((saleWh / afsDays) * shipmentPlanDays) - availableQty);
            }

            // Logic to calculate Int - WH from Frontend replicated here
            let intWh = item.int_wh; // Keep original if shipWh is negative or invalid
            let decWh = "";
            let calculatedFinalWh = "";
            if (!isNaN(shipWh) && shipWh >= 0) {
                if (shipWh === 0) {
                    intWh = 1;
                    decWh = 0;
                } else if (bunchQty > 0) {
                    intWh = Math.floor(shipWh / bunchQty);
                    decWh = (shipWh / bunchQty) - intWh;
                }
                
                if (shipWh > 0 && decWh !== "") {
                    calculatedFinalWh = (intWh * bunchQty) + (decWh > 0 ? bunchQty : 0);
                }
            }

            const displayFinalWh = item.is_manual_final_wh ? item.final_wh : calculatedFinalWh;

            // --- SUGGEST FINAL-WH CALCULATION ---
            let suggestedShipWh = 0;
            if (afsDays > 0) {
                suggestedShipWh = Math.ceil(((saleWhAvg / afsDays) * shipmentPlanDays) - availableQty);
            }

            let sugIntWh = "";
            let sugDecWh = "";
            let suggestFinalWh = "";

            if (!isNaN(suggestedShipWh) && suggestedShipWh >= 0) {
                if (suggestedShipWh === 0) {
                    sugIntWh = 1;
                    sugDecWh = 0;
                } else if (bunchQty > 0) {
                    sugIntWh = Math.floor(suggestedShipWh / bunchQty);
                    sugDecWh = (suggestedShipWh / bunchQty) - sugIntWh;
                }

                if (suggestedShipWh > 0 && sugDecWh !== "") {
                    suggestFinalWh = (sugIntWh * bunchQty) + (sugDecWh > 0 ? bunchQty : 0);
                }
            }

            const displaySuggestFinalWh = item.is_manual_suggest_final_wh ? item.suggest_final_wh : suggestFinalWh;
            const demand = Number(displaySuggestFinalWh) || 0;

            const grp = item.group_name ? item.group_name.trim().toLowerCase() : 'unknown';
            if (!groupDemandMap[grp]) groupDemandMap[grp] = 0;
            groupDemandMap[grp] += Math.max(0, demand); // Accumulate valid demand

            return {
                ...item,
                tra_qty: traQty,
                quantity: quantity,
                sale_total: businessQtyMap[item.sku] || 0,
                sale_wh: saleWh,
                sale_wh_avg: Math.round(saleWhAvg),
                available_qty: availableQty,
                ship_wh: Math.max(0, Math.round(shipWh)), // Final requirement rounded and not negative
                int_wh: intWh,
                dec_wh: decWh,
                final_wh: displayFinalWh,
                suggest_final_wh: displaySuggestFinalWh,
                _demand: Math.max(0, demand)
            };
        });

        // Second Pass: Proportional Stock Allocation
        const itemsWithTraQty = preliminaryItems.map((item) => {
            const grp = item.group_name ? item.group_name.trim().toLowerCase() : 'unknown';
            const totalAvailable = stockAvailableMap[grp] !== undefined ? Number(stockAvailableMap[grp]) : null;
            const totalDemand = groupDemandMap[grp] || 0;
            
            let stock_alloc_qty = null;
            let finalSuggested = item.suggest_final_wh;

            if (totalAvailable !== null) {
                if (totalDemand === 0) {
                    stock_alloc_qty = 0;
                    finalSuggested = 0;
                } else if (totalAvailable >= totalDemand) {
                    stock_alloc_qty = item._demand; // Enough stock to fulfill this SKU's demand entirely
                } else {
                    // Proportional allocation
                    stock_alloc_qty = Math.floor((item._demand / totalDemand) * totalAvailable);
                    finalSuggested = Math.min(item._demand, stock_alloc_qty);
                }
            }

            // Clean up temporary fields
            delete item._demand;

            return {
                ...item,
                stock_alloc: totalAvailable !== null ? `${totalAvailable} / ${stock_alloc_qty}` : '',
                stock_alloc_ratio: totalAvailable !== null && item._demand > 0 ? (stock_alloc_qty / item._demand) : null,
                suggest_final_wh: item.is_manual_suggest_final_wh ? item.suggest_final_wh : finalSuggested
            };
        });

        // SAVE REPORT IDs IN MASTER DATA FOR SMART DELETE
        let latestAfsIdToSave = null;
        if (latestAfsReport && latestAfsReport.length > 0) latestAfsIdToSave = latestAfsReport[0].id;
        
        await connection.query(
            `UPDATE shipment_calculations_master SET afs_report_id = ?, dih_report_id = ?, transit_report_id = ? WHERE id = ?`,
            [latestAfsIdToSave, latestDihId, latestTransitId, masterData.id]
        );

        // --- BACKGROUND AUTO-SAVE ---
        // Dynamically calculated values ko DB me save kar dete hain
        // Taaki 'Completed' hone par yahi frozen data return ho sake
        if (masterData.status !== 'Completed') {
            setImmediate(async () => {
                let bgConnection;
                try {
                    bgConnection = await db.getConnection();
                    for (const item of itemsWithTraQty) {
                        await bgConnection.query(
                            `UPDATE shipment_calculation_items SET tra_qty=?, quantity=?, available_qty=?, sale_wh=?, sale_wh_avg=?, ship_wh=?, int_wh=?, dec_wh=?, final_wh=?, suggest_final_wh=?, stock_alloc=? WHERE id=?`,
                            [item.tra_qty, item.quantity, item.available_qty, item.sale_wh, item.sale_wh_avg, item.ship_wh, item.int_wh, item.dec_wh || 0, item.final_wh || 0, item.suggest_final_wh || 0, item.stock_alloc || null, item.id]
                        );
                    }
                } catch (e) {
                    console.error("Auto-save items background error:", e);
                } finally {
                    if (bgConnection) bgConnection.release();
                }
            });
        }

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
// 5.5 UPDATE ITEM SUGGEST WH (MANUAL OVERRIDE)
// =======================================================
const updateItemSuggestWh = async (req, res) => {
    try {
        const { itemId, suggestWh } = req.body;
        const connection = await db.getConnection();

        // Value update karo aur flag ko 1 (true) kar do
        await connection.query(
            `UPDATE shipment_calculation_items SET suggest_final_wh = ?, is_manual_suggest_final_wh = 1 WHERE id = ?`,
            [suggestWh, itemId]
        );
        connection.release();
        return successResponse(res, "Suggest Final WH manually updated!", null, 200);
    } catch (error) {
        console.error("Manual Item Update Error:", error);
        return errorResponse(res, "Failed to update Suggest Final WH", 500);
    }
};

// =======================================================
// EVENT MULTIPLIER: Apply event multiplier to all suggest_final_wh values of a plan
// Frontend sends pre-calculated values (from displayData) to avoid stale DB reads
// =======================================================
const applyEventMultiplier = async (req, res) => {
    try {
        const { items } = req.body;
        // items: [{ id, newSuggestFinalWh }]
        if (!items || !Array.isArray(items) || items.length === 0) {
            return errorResponse(res, "items array is required", 400);
        }

        const connection = await db.getConnection();

        for (const item of items) {
            if (item.id != null && item.newSuggestFinalWh != null && !isNaN(Number(item.newSuggestFinalWh))) {
                await connection.query(
                    `UPDATE shipment_calculation_items SET suggest_final_wh = ?, is_manual_suggest_final_wh = 1 WHERE id = ?`,
                    [Math.ceil(Number(item.newSuggestFinalWh)), item.id]
                );
            }
        }

        connection.release();
        return successResponse(res, "Event multiplier applied to Sugg Final WH!", null, 200);
    } catch (error) {
        console.error("Apply Event Multiplier Error:", error);
        return errorResponse(res, "Failed to apply event multiplier", 500);
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
            `UPDATE shipment_calculation_items SET is_manual_final_wh = 0, is_manual_suggest_final_wh = 0 WHERE plan_id = ?`,
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

// =======================================================
// 8. GET CALCULATION HISTORY
// =======================================================
const getCalculationHistory = async (req, res) => {
    try {
        const { marketplace_id } = req.query;
        if (!marketplace_id) return errorResponse(res, "Marketplace ID is required", 400);

        const connection = await db.getConnection();

        // 1. Check if the current dynamic data is empty
        const [dihRows] = await connection.query(`SELECT SUM(ending_warehouse_balance) as t FROM dih_data`);
        const [afsRows] = await connection.query(`SELECT SUM(shipped_quantity) as t FROM afs_data`);
        const dynamicSum = (Number(dihRows[0]?.t) || 0) + (Number(afsRows[0]?.t) || 0);

        // Fetch all plans for this marketplace
        const [allPlans] = await connection.query(
            `SELECT id, created_at, status 
             FROM shipment_calculations_master
             WHERE marketplace_id = ? AND is_deleted = 0
             ORDER BY created_at DESC`,
            [marketplace_id]
        );

        let finalRows = [];
        for (const plan of allPlans) {
            if (plan.status !== 'Completed') {
                // For Draft plans, they rely on dynamicSum. 
                // If dynamicSum > 0, they will show some data, so include them.
                if (dynamicSum > 0) {
                    finalRows.push(plan);
                } else {
                    // Check if user manually entered final_wh
                    const [itemSum] = await connection.query(`
                        SELECT SUM(COALESCE(CAST(NULLIF(final_wh, '') AS DECIMAL(10,2)), 0)) as total_final_wh
                        FROM shipment_calculation_items WHERE plan_id = ?
                    `, [plan.id]);
                    if (itemSum[0]?.total_final_wh > 0) {
                        finalRows.push(plan);
                    }
                }
            } else {
                // Check if DB values have data
                const [itemSum] = await connection.query(`
                    SELECT SUM(COALESCE(tra_qty, 0)) + SUM(COALESCE(quantity, 0)) + SUM(COALESCE(available_qty, 0)) + SUM(COALESCE(sale_wh, 0)) + SUM(COALESCE(CAST(NULLIF(final_wh, '') AS DECIMAL(10,2)), 0)) as total
                    FROM shipment_calculation_items WHERE plan_id = ?
                `, [plan.id]);
                if (itemSum[0]?.total > 0) {
                    finalRows.push(plan);
                }
            }
        }

        connection.release();
        return successResponse(res, "History fetched", finalRows, 200);
    } catch (error) {
        console.error("Get History Error:", error);
        return errorResponse(res, "Failed to fetch history", 500);
    }
};

// =======================================================
// 9. DELETE CALCULATION PLAN (SMART DELETE)
// =======================================================
// const fs = require('fs');
// const path = require('path');

const deleteCalculationPlan = async (req, res) => {
    let connection;
    try {
        const planId = req.params.id;
        if (!planId) return errorResponse(res, "Plan ID is required", 400);

        connection = await db.getConnection();

        // 1. Fetch the plan details to get report IDs
        const [planRows] = await connection.query(
            `SELECT afs_report_id, dih_report_id, transit_report_id FROM shipment_calculations_master WHERE id = ?`,
            [planId]
        );

        if (planRows.length === 0) {
            connection.release();
            return errorResponse(res, "Plan not found", 404);
        }

        const { afs_report_id, dih_report_id, transit_report_id } = planRows[0];
        const reportIdsToDelete = [afs_report_id, dih_report_id, transit_report_id].filter(id => id !== null);

        // 2. Soft Delete the Master Plan (so SKUs remain safe)
        await connection.query(`UPDATE shipment_calculations_master SET is_deleted = 1 WHERE id = ?`, [planId]);

        // 3. Delete Physical Files & Database Records for associated reports
        if (reportIdsToDelete.length > 0) {
            // Find file names
            const [reportRows] = await connection.query(
                `SELECT id, file_name FROM uploaded_reports WHERE id IN (?)`,
                [reportIdsToDelete]
            );

            for (const report of reportRows) {
                // Delete physical file
                const filePath = path.join(__dirname, "../../client/public/upload", report.file_name);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            // Delete from uploaded_reports (Cascades to afs_data, dih_data, transit_shipment_data)
            await connection.query(`DELETE FROM uploaded_reports WHERE id IN (?)`, [reportIdsToDelete]);
        }

        connection.release();
        return successResponse(res, "Plan and associated raw files deleted successfully", null, 200);
    } catch (error) {
        console.error("Delete Plan Error:", error);
        if (connection) connection.release();
        return errorResponse(res, "Failed to delete plan", 500);
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
    updateItemSuggestWh,
    resetFinalWh,
    getManifestDetails,
    getCalculationHistory,
    deleteCalculationPlan,
    applyEventMultiplier
};
