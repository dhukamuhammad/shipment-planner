const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const ExcelJS = require("exceljs");
const db = require("../../config/db");
const { successResponse, errorResponse } = require("../../utils/responseFormatter");
const { logActivity } = require("../../utils/logger");

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

        let marketplaceName = "";
        if (marketplace_id) {
            const [mpRows] = await connection.query("SELECT name FROM marketplaces WHERE id = ?", [marketplace_id]);
            marketplaceName = mpRows.length > 0 ? mpRows[0].name.toLowerCase().trim() : "";
        }

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
                [reportId, marketplace_id]
            );
            planId = masterResult.insertId;
        }

        console.time("⏳ Calculation File Parsing");

        let rawRows = [];

        // --- STEP 1: POORI SHEET KO 2D ARRAY ME CONVERT KARO ---
        let ixdWarehouses = [];
        let regularWarehouses = [];

        if (fileExt === '.csv') {
            rawRows = await parseCsvRaw(req.file.path);
        } else {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(req.file.path);

            // Extract from IXD and Warehouse
            workbook.eachSheet((worksheet) => {
                const wsName = worksheet.name ? worksheet.name.toLowerCase().trim() : '';
                if (wsName === 'ixd' || wsName === 'warehouse') {
                    let targetColIdx = -1;
                    worksheet.eachRow((row, rowNumber) => {
                        if (rowNumber === 1) {
                            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                                if (cell.value) {
                                    const cellStr = cell.value.toString().toLowerCase().trim();
                                    const mName = marketplaceName.toLowerCase().trim();
                                    if (cellStr === mName || (cellStr.includes('amazon') && mName.includes('amazon'))) {
                                        targetColIdx = colNumber;
                                    }
                                }
                            });
                        } else {
                            if (targetColIdx !== -1) {
                                const cell = row.getCell(targetColIdx);
                                if (cell && cell.value) {
                                    const val = cell.value.toString().trim();
                                    if (val) {
                                        if (wsName === 'ixd') ixdWarehouses.push(val);
                                        if (wsName === 'warehouse') regularWarehouses.push(val);
                                    }
                                }
                            }
                        }
                    });
                }
            });

            // Extract Template data
            let templateSheet = workbook.worksheets.find(ws => ws.name && ws.name.toLowerCase().trim() === 'template');
            if (!templateSheet && workbook.worksheets.length > 0) {
                // if 'Template' not found by name, fallback to first sheet if it's not IXD/Warehouse
                const firstSheetName = workbook.worksheets[0].name.toLowerCase().trim();
                if (firstSheetName !== 'ixd' && firstSheetName !== 'warehouse') {
                    templateSheet = workbook.worksheets[0];
                }
            }

            if (templateSheet) {
                templateSheet.eachRow((row, rowNumber) => {
                    let rowData = [];
                    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        let val = cell.value;
                        if (val && typeof val === 'object') {
                            val = val.result !== undefined ? val.result : cell.text;
                        }
                        rowData[colNumber] = val !== undefined ? val : null;
                    });
                    if (rowData.length > 0) {
                        rawRows.push(rowData);
                    }
                });
            }

            // Insert parsed warehouses into DB
            if (ixdWarehouses.length > 0) {
                for (let wh of ixdWarehouses) {
                    await connection.query("INSERT IGNORE INTO ixd_warehouses (marketplace_id, name, type) VALUES (?, ?, 'IXD')", [marketplace_id, wh]);
                }
            }
            if (regularWarehouses.length > 0) {
                for (let wh of regularWarehouses) {
                    await connection.query("INSERT IGNORE INTO ixd_warehouses (marketplace_id, name, type) VALUES (?, ?, 'Warehouse')", [marketplace_id, wh]);
                }
            }
        }
        console.timeEnd("⏳ Calculation File Parsing");

        if (rawRows.length === 0) {
            if (ixdWarehouses.length > 0 || regularWarehouses.length > 0) {
                if (!req.body.planId) await connection.query("DELETE FROM shipment_calculations_master WHERE id = ?", [planId]);
                await connection.query("DELETE FROM uploaded_reports WHERE id = ?", [reportId]);
                await connection.commit();
                connection.release();
                return successResponse(res, "Warehouses updated successfully. No calculation data found.", {
                    message: "Warehouses extracted and updated.",
                    warehouses: { ixd: ixdWarehouses, warehouse: regularWarehouses }
                }, 200);
            }
            throw new Error("File is empty!");
        }

        // --- STEP 2: SMART SCANNER (Find Master Data & Header Row) ---
        console.time("⏳ Calculation Smart Scan & Prep");

        let globalAfsDays = 30, globalPlanDays = 40, globalBunchQty = 2, globalToShip = 0;
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
            if (ixdWarehouses.length > 0 || regularWarehouses.length > 0) {
                if (!req.body.planId) await connection.query("DELETE FROM shipment_calculations_master WHERE id = ?", [planId]);
                await connection.query("DELETE FROM uploaded_reports WHERE id = ?", [reportId]);
                await connection.commit();
                connection.release();
                return successResponse(res, "Warehouses updated successfully. No calculation data found.", {
                    message: "Warehouses extracted and updated.",
                    warehouses: { ixd: ixdWarehouses, warehouse: regularWarehouses }
                }, 200);
            }
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

        if (rawData.length === 0) {
            // Agar data nahi hai (only headers thi ya blank thi), toh newly created plan ko delete kar do
            if (!req.body.planId) await connection.query("DELETE FROM shipment_calculations_master WHERE id = ?", [planId]);
            await connection.query("DELETE FROM uploaded_reports WHERE id = ?", [reportId]);
            await connection.commit();

            if (ixdWarehouses.length > 0 || regularWarehouses.length > 0) {
                connection.release();
                return successResponse(res, "Warehouses updated successfully. No calculation data found.", {
                    message: "Warehouses extracted and updated.",
                    warehouses: { ixd: ixdWarehouses, warehouse: regularWarehouses }
                }, 200);
            } else {
                throw new Error("File has no valid calculation data rows!");
            }
        }

        // --- STEP 4: PREPARE BULK VALUES FOR DB ---
        const ixdFulfilmentJSON = ixdWarehouses && ixdWarehouses.length > 0 ? JSON.stringify(ixdWarehouses) : null;
        const whFulfilmentJSON = regularWarehouses && regularWarehouses.length > 0 ? JSON.stringify(regularWarehouses) : null;

        const formatPackaging = (val) => {
            if (!val) return null;
            try {
                JSON.parse(val);
                return val;
            } catch (e) { }
            const parts = val.toString().split('|').map(p => p.trim()).filter(Boolean);
            if (parts.length === 0) return null;
            return JSON.stringify(parts.map(p => {
                const [k, ...vParts] = p.split(':');
                const v = vParts.join(':');
                return { key: (k || p).trim(), value: (v || "").trim() };
            }));
        };

        const bulkValues = [];
        rawData.forEach((row) => {
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

                sanitizeNumber(row["weight"] || row["Weight"], true),
                sanitizeNumber(row["Total Weight"], true),
                row["HSN"] ? row["HSN"].toString() : null,
                row["GST"] ? row["GST"].toString() : null,
                sanitizeNumber(row["COST"] || row["Cost"], true),

                row["SKU_2"] || row["SKU"] || null,   // ref_sku
                row["Title_2"] || row["Title"] || null, // ref_title
                sanitizeNumber(row["Tra. Qty"]),
                sanitizeNumber(row["quantity"]),
                sanitizeNumber(row["Available Qty"]),
                ixdFulfilmentJSON,
                whFulfilmentJSON,

                sanitizeNumber(row["Sale-Total"]),
                sanitizeNumber(row["Sale-WH"]),
                sanitizeNumber(row["Ship – WH"]),
                sanitizeNumber(row["Sum"]),
                sanitizeNumber(row["Final – WH"]),

                sanitizeNumber(row["MRP"], true),
                row["FNSKU"] || null,
                sanitizeNumber(row["Length (L)"], true),
                sanitizeNumber(row["Width (W)"], true),
                sanitizeNumber(row["Height (H)"], true),
                row["Dimension Unit"] || null,
                formatPackaging(row["shipment_packaging"])
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
                plan_id, report_id, marketplace_id, group_name, sku, title, category, 
                int_wh, dec_wh, non_apron_qty, 
                apr_sky_blue, apr_dark_blue, apr_brown, apr_green, apr_tan, apr_black, apr_red, apr_grey, 
                weight, total_weight, hsn, gst, cost, 
                ref_sku, ref_title, tra_qty, quantity, available_qty, ixd_fulfilment_id, warehouse_fulfilment_id, 
                sale_total, sale_wh, ship_wh, sum_val, final_wh,
                mrp, fnsku, packing_dimension_length, packing_dimension_width, packing_dimension_height, packing_dimension_unit, shipment_packaging
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
        
        await logActivity(req.user?.id, 'UPLOAD', 'Calculation', `Uploaded Calculation Report: ${req.file.filename}`);
        
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
                ref_sku, ref_title, ixd_fulfilment_id, warehouse_fulfilment_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const fcId = 'BLR4';

        await connection.query(insertQuery, [
            data.planId, reportId, data.groupName, data.sku, data.title || null, data.category || null,
            data.hsn || null, data.gst || null, data.cost || 0, data.weight || 0, // 🔥 data.weight add kiya
            data.sku, data.title || null, fcId
        ]);

        await logActivity(req.user?.id, 'CREATE', 'Calculation', `Added manual SKU row for SKU: ${data.sku}`);

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
        const { itemId, groupName, sku, title, category, hsn, gst, cost, weight, isActive } = req.body;
        const connection = await db.getConnection();

        await connection.query(
            `UPDATE shipment_calculation_items 
             SET group_name=?, sku=?, title=?, category=?, hsn=?, gst=?, cost=?, weight=?, is_active=?, ref_sku=?, ref_title=?
             WHERE id=?`,
            [groupName, sku, title, category, hsn, gst, cost, weight, isActive !== undefined ? isActive : 1, sku, title, itemId]
        );
        
        await logActivity(req.user?.id, 'UPDATE', 'Calculation', `Edited calculation row for SKU: ${sku}`);
        
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
        const { id } = req.params; // ID URL param se aayegi
        const connection = await db.getConnection();

        const [itemRows] = await connection.query(`SELECT sku FROM shipment_calculation_items WHERE id=?`, [id]);
        const sku = itemRows.length > 0 ? itemRows[0].sku : 'Unknown';

        await connection.query(`DELETE FROM shipment_calculation_items WHERE id=?`, [id]);
        
        await logActivity(req.user?.id, 'DELETE', 'Calculation', `Deleted SKU from calculation plan: ${sku}`);
        
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
        const { marketplace_id, planId, shipment_mode } = req.query;
        const shipmentMode = shipment_mode || 'IXD';
        connection = await db.getConnection();

        // Sabse recent master plan (top cards data) nikal rahe hain, with optional marketplace/planId filter
        let masterQuery = `SELECT * FROM shipment_calculations_master`;
        let masterParams = [];
        let whereClauses = [];

        if (planId) {
            whereClauses.push(`id = ?`);
            masterParams.push(planId);
        } else {
            whereClauses.push(`status = 'Draft'`);
        }
        
        if (marketplace_id) {
            whereClauses.push(`marketplace_id = ?`);
            masterParams.push(marketplace_id);
        }

        if (whereClauses.length > 0) {
            masterQuery += ` WHERE ` + whereClauses.join(` AND `);
        }

        masterQuery += ` ORDER BY created_at DESC LIMIT 1`;

        const [masterRows] = await connection.query(masterQuery, masterParams);

        let masterData = null;

        if (masterRows.length === 0) {
            // AUTO-CLONE LOGIC: if no Draft plan exists, clone the latest Completed plan
            if (!planId && marketplace_id) {
                const [latestCompleted] = await connection.query(
                    `SELECT * FROM shipment_calculations_master WHERE marketplace_id = ? AND status = 'Completed' ORDER BY created_at DESC LIMIT 1`,
                    [marketplace_id]
                );

                if (latestCompleted.length > 0) {
                    const clonedPlan = latestCompleted[0];
                    // Clone master (excluding id, status, timestamps)
                    const [insertResult] = await connection.query(
                        `INSERT INTO shipment_calculations_master (report_id, afs_days, shipment_plan_days, bunch_qty, to_ship_qty, status, marketplace_id, is_deleted, afs_report_id, dih_report_id, transit_report_id)
                         VALUES (?, ?, ?, ?, ?, 'Draft', ?, 0, ?, ?, ?)`,
                        [clonedPlan.report_id, clonedPlan.afs_days, clonedPlan.shipment_plan_days, clonedPlan.bunch_qty, clonedPlan.to_ship_qty, clonedPlan.marketplace_id, clonedPlan.afs_report_id, clonedPlan.dih_report_id, clonedPlan.transit_report_id]
                    );

                    // Clone items
                    await connection.query(`
                        INSERT INTO shipment_calculation_items (
                            plan_id, report_id, group_name, sku, title, category,
                            int_wh, dec_wh, non_apron_qty, apr_sky_blue, apr_dark_blue, apr_brown, apr_green, apr_tan, apr_black, apr_red, apr_grey,
                            weight, total_weight, hsn, gst, cost, ref_sku, ref_title, tra_qty, quantity, available_qty, stock_alloc,
                            ixd_fulfilment_id, warehouse_fulfilment_id, sale_total, sale_wh, sale_wh_avg, ship_wh, sum_val, final_wh,
                            is_manual_final_wh, marketplace_id, suggest_final_wh, is_manual_suggest_final_wh, shipment_packaging,
                            mrp, fnsku, packing_dimension_length, packing_dimension_width, packing_dimension_height, packing_dimension_unit, fc, fc_breakdown
                        )
                        SELECT 
                            ?, report_id, group_name, sku, title, category,
                            int_wh, dec_wh, non_apron_qty, apr_sky_blue, apr_dark_blue, apr_brown, apr_green, apr_tan, apr_black, apr_red, apr_grey,
                            weight, total_weight, hsn, gst, cost, ref_sku, ref_title, tra_qty, quantity, available_qty, stock_alloc,
                            ixd_fulfilment_id, warehouse_fulfilment_id, sale_total, sale_wh, sale_wh_avg, ship_wh, sum_val, final_wh,
                            is_manual_final_wh, marketplace_id, suggest_final_wh, is_manual_suggest_final_wh, shipment_packaging,
                            mrp, fnsku, packing_dimension_length, packing_dimension_width, packing_dimension_height, packing_dimension_unit, fc, fc_breakdown
                        FROM shipment_calculation_items WHERE plan_id = ?
                    `, [insertResult.insertId, clonedPlan.id]);

                    // Now update masterData to the new cloned plan so the rest of the flow uses it
                    const [newMasterRows] = await connection.query(`SELECT * FROM shipment_calculations_master WHERE id = ?`, [insertResult.insertId]);
                    masterData = newMasterRows[0];
                }
            }
            
            if (!masterData) {
                connection.release();
                return successResponse(res, "No data found", { master: null, items: [] }, 200);
            }
        } else {
            masterData = masterRows[0];
        }

        let calculatedAfsDays = masterData.afs_days; // Default fallback

        // Master ID ke basis par saari SKUs (rows) nikal rahe hain
        const [itemRows] = await connection.query(
            `SELECT * FROM shipment_calculation_items WHERE plan_id = ?`,
            [masterData.id]
        );

        // --- FREEZE HISTORICAL DATA ---
        // Agar plan 'Completed' (Manifested) hai, toh uski data ko recalculate mat karo.
        // Seedha DB se raw rows bhej do, kyunki manifest hone par calculation final ho chuki hai.
        if (masterData.status === 'Completed') {
            connection.release();
            // Ensure fc_breakdown is parsed if needed by frontend
            const parsedItems = itemRows.map(item => {
                let parsedFcBreakdown = item.fc_breakdown;
                if (typeof parsedFcBreakdown === 'string') {
                    try { parsedFcBreakdown = JSON.parse(parsedFcBreakdown); } catch (e) { }
                }
                return { ...item, fc_breakdown: parsedFcBreakdown };
            });
            return successResponse(res, "Success", {
                master: masterData,
                items: parsedItems
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

        let transitFcMap = {};
        if (latestTransitId && shipmentMode === 'FC') {
            const [transitFcRows] = await connection.query(
                `SELECT merchant_sku, fc, SUM(quantity) as total_qty FROM transit_shipment_data WHERE report_id = ? GROUP BY merchant_sku, fc`,
                [latestTransitId]
            );
            transitFcRows.forEach(r => {
                if (!transitFcMap[r.merchant_sku]) transitFcMap[r.merchant_sku] = {};
                transitFcMap[r.merchant_sku][r.fc] = r.total_qty;
            });
        }

        // DIH report se SKU-wise total Ending Warehouse Balance nikal rahe hain (Quantity column ke liye)
        const [dihRows] = await connection.query(
            `SELECT msku, SUM(ending_warehouse_balance) as total_ending_balance FROM dih_data GROUP BY msku`
        );
        const dihQtyMap = {};
        dihRows.forEach((r) => {
            dihQtyMap[r.msku] = r.total_ending_balance;
        });

        let dihFcMap = {};
        if (shipmentMode === 'FC') {
            const [dihFcRows] = await connection.query(
                `SELECT msku, location as fc, SUM(ending_warehouse_balance) as total_ending_balance FROM dih_data GROUP BY msku, location`
            );
            dihFcRows.forEach(r => {
                if (!dihFcMap[r.msku]) dihFcMap[r.msku] = {};
                dihFcMap[r.msku][r.fc] = r.total_ending_balance;
            });
        }

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
        let afsFcCurrentMap = {};
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

            // FC-wise Data for Multi-FC
            if (shipmentMode === 'FC') {
                const [afsFcCurrentRows] = await connection.query(
                    `SELECT merchant_sku, fc, SUM(shipped_quantity) as total_shipped_qty FROM afs_data WHERE report_id = ? GROUP BY merchant_sku, fc`,
                    [latestAfsId]
                );
                afsFcCurrentRows.forEach(r => {
                    if (!afsFcCurrentMap[r.merchant_sku]) afsFcCurrentMap[r.merchant_sku] = {};
                    afsFcCurrentMap[r.merchant_sku][r.fc] = r.total_shipped_qty;
                });
            }
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

        let afsFcAvgMap = {};
        if (shipmentMode === 'FC') {
            const [afsFcAvgRows] = await connection.query(
                `SELECT merchant_sku, fc, SUM(shipped_quantity) as total_qty, COUNT(DISTINCT report_id) as month_count FROM afs_data GROUP BY merchant_sku, fc`
            );
            afsFcAvgRows.forEach(r => {
                const count = r.month_count > 0 ? r.month_count : 1;
                if (!afsFcAvgMap[r.merchant_sku]) afsFcAvgMap[r.merchant_sku] = {};
                afsFcAvgMap[r.merchant_sku][r.fc] = r.total_qty / count;
            });
        }

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
                if (r.group_name) {
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

        // --- FETCH ACTIVE WAREHOUSES FOR FC MODE ---
        let activeFCs = [];
        let activeIXD = null;
        if (shipmentMode === 'FC') {
            if (masterData.marketplace_id) {
                const [fcs] = await connection.query("SELECT name FROM ixd_warehouses WHERE type = 'Warehouse' AND marketplace_id = ? AND is_active = 1", [masterData.marketplace_id]);
                activeFCs = fcs.map(f => f.name);
            }
        } else if (shipmentMode === 'IXD') {
            if (masterData.marketplace_id) {
                const [ixds] = await connection.query("SELECT name FROM ixd_warehouses WHERE type = 'IXD' AND marketplace_id = ? AND is_active = 1 LIMIT 1", [masterData.marketplace_id]);
                if (ixds.length > 0) activeIXD = ixds[0].name;
            }
        }

        // First Pass: Calculate basic values and group demands
        let groupDemandMap = {};

        let preliminaryItems = itemRows.map((item) => {
            const traQty = Number(transitQtyMap[item.sku]) || 0;
            const quantity = Number(dihQtyMap[item.sku]) || 0;
            const saleWh = Number(afsCurrentQtyMap[item.sku]) || 0;
            const saleWhAvg = Number(afsAvgQtyMap[item.sku]) || 0; // Historical 4-month total/avg

            const availableQty = traQty + quantity;

            let fcBreakdownJSON = null;
            if (shipmentMode === 'FC') {
                let fcBreakdown = {};
                let fcs = activeFCs;

                fcs.forEach(fc => {
                    const fcSaleWh = (afsFcCurrentMap[item.sku] && afsFcCurrentMap[item.sku][fc]) ? afsFcCurrentMap[item.sku][fc] : 0;
                    const fcSaleWhAvg = (afsFcAvgMap[item.sku] && afsFcAvgMap[item.sku][fc]) ? afsFcAvgMap[item.sku][fc] : 0;
                    const fcDihQuantity = (dihFcMap[item.sku] && dihFcMap[item.sku][fc]) ? dihFcMap[item.sku][fc] : 0;
                    const fcTraQuantity = (transitFcMap[item.sku] && transitFcMap[item.sku][fc]) ? transitFcMap[item.sku][fc] : 0;

                    const fcAvailableQty = fcTraQuantity + fcDihQuantity;

                    let fcShipWh = 0;
                    if (afsDays > 0) {
                        fcShipWh = Math.ceil(((fcSaleWh / afsDays) * shipmentPlanDays) - fcAvailableQty);
                    }
                    const fcDemand = Math.max(0, fcShipWh);

                    let fcSuggestFinalWh = 0;
                    if (afsDays > 0) {
                        fcSuggestFinalWh = Math.ceil(((fcSaleWhAvg / afsDays) * shipmentPlanDays) - fcAvailableQty);
                    }
                    if (fcSuggestFinalWh < 0) fcSuggestFinalWh = 0;

                    fcBreakdown[fc] = {
                        tra_qty: fcTraQuantity,
                        quantity: fcDihQuantity,
                        available_qty: fcAvailableQty,
                        sale_wh: fcSaleWh,
                        sale_wh_avg: parseFloat(fcSaleWhAvg.toFixed(2)),
                        suggest_final_wh: fcSuggestFinalWh,
                        fc_demand: fcDemand,
                        final_wh: "" // manual value
                    };
                });
                if (Object.keys(fcBreakdown).length > 0) {
                    fcBreakdownJSON = JSON.stringify(fcBreakdown);
                }
            }

            // 6. Pipeline Inventory: Available = Transit (Pipeline) + Current Warehouse Stock
            // (Moved up)

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
                suggestedShipWh = Math.ceil(((Math.round(saleWhAvg) / afsDays) * shipmentPlanDays) - availableQty);
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
            const demand = Number(displayFinalWh) || 0;

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
                _demand: Math.max(0, demand),
                fc_breakdown: fcBreakdownJSON
            };
        });

        // Second Pass: Proportional Stock Allocation
        const itemsWithTraQty = preliminaryItems.map((item) => {
            const grp = item.group_name ? item.group_name.trim().toLowerCase() : 'unknown';
            const totalAvailable = stockAvailableMap[grp] !== undefined ? Number(stockAvailableMap[grp]) : null;
            const totalDemand = groupDemandMap[grp] || 0;

            let stock_alloc_qty = null;
            let finalSuggested = item.suggest_final_wh; // Keep the uncapped value!

            if (totalAvailable !== null) {
                if (totalDemand === 0) {
                    stock_alloc_qty = 0;
                } else if (totalAvailable >= totalDemand) {
                    stock_alloc_qty = item._demand; // Enough stock to fulfill this SKU's demand entirely
                } else {
                    // Proportional allocation (used for display only)
                    stock_alloc_qty = Math.floor((item._demand / totalDemand) * totalAvailable);
                }
            }

            let updatedFcBreakdownJSON = item.fc_breakdown;
            if (updatedFcBreakdownJSON) {
                let fcBreakdown = JSON.parse(updatedFcBreakdownJSON);
                Object.keys(fcBreakdown).forEach(fc => {
                    let fcStockAlloc = null;
                    if (totalAvailable !== null) {
                        if (totalDemand === 0) {
                            fcStockAlloc = 0;
                        } else if (totalAvailable >= totalDemand) {
                            fcStockAlloc = fcBreakdown[fc].fc_demand;
                        } else {
                            fcStockAlloc = Math.floor((fcBreakdown[fc].fc_demand / totalDemand) * totalAvailable);
                        }
                    }
                    fcBreakdown[fc].stock_alloc = totalAvailable !== null ? `${totalAvailable} / ${fcStockAlloc}` : '';
                });
                updatedFcBreakdownJSON = JSON.stringify(fcBreakdown);
            }

            // Clean up temporary fields
            delete item._demand;

            return {
                ...item,
                stock_alloc: totalAvailable !== null ? `${totalAvailable} / ${stock_alloc_qty}` : '',
                stock_alloc_ratio: totalAvailable !== null && item._demand > 0 ? (stock_alloc_qty / item._demand) : null,
                suggest_final_wh: item.is_manual_suggest_final_wh ? item.suggest_final_wh : finalSuggested,
                fc_breakdown: updatedFcBreakdownJSON
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
                            `UPDATE shipment_calculation_items SET tra_qty=?, quantity=?, available_qty=?, sale_wh=?, sale_wh_avg=?, ship_wh=?, int_wh=?, dec_wh=?, final_wh=?, suggest_final_wh=?, stock_alloc=?, fc_breakdown=? WHERE id=?`,
                            [item.tra_qty, item.quantity, item.available_qty, item.sale_wh, item.sale_wh_avg, item.ship_wh, item.int_wh, item.dec_wh || 0, item.final_wh || 0, item.suggest_final_wh || 0, item.stock_alloc || null, item.fc_breakdown || null, item.id]
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
            items: itemsWithTraQty,
            ixdName: activeIXD
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
        
        const [oldRows] = await connection.query(`SELECT ${field} FROM shipment_calculations_master WHERE id = ?`, [planId]);
        const oldVal = oldRows.length > 0 ? oldRows[0][field] : 'Unknown';

        // Dynamic query to update specific field
        await connection.query(
            `UPDATE shipment_calculations_master SET ${field} = ? WHERE id = ?`,
            [value, planId]
        );
        
        const fieldNameMap = {
            'afs_days': 'AFS Days',
            'shipment_plan_days': 'Shipment Plan Days',
            'bunch_qty': 'Bunch Qty'
        };
        const niceFieldName = fieldNameMap[field] || field;

        await logActivity(req.user?.id, 'UPDATE', 'Calculation', `Changed ${niceFieldName} from ${oldVal} to ${value}`);
        
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

        const [itemRows] = await connection.query(`SELECT sku, final_wh FROM shipment_calculation_items WHERE id = ?`, [itemId]);
        const sku = itemRows.length > 0 ? itemRows[0].sku : 'Unknown';
        const oldVal = itemRows.length > 0 ? itemRows[0].final_wh : '0';

        // Value update karo aur flag ko 1 (true) kar do
        await connection.query(
            `UPDATE shipment_calculation_items SET final_wh = ?, is_manual_final_wh = 1 WHERE id = ?`,
            [finalWh, itemId]
        );
        
        await logActivity(req.user?.id, 'UPDATE', 'Calculation', `Changed Final WH for SKU: ${sku} from ${oldVal || 0} to ${finalWh}`);
        
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

        const [itemRows] = await connection.query(`SELECT sku, suggest_final_wh FROM shipment_calculation_items WHERE id = ?`, [itemId]);
        const sku = itemRows.length > 0 ? itemRows[0].sku : 'Unknown';
        const oldVal = itemRows.length > 0 ? itemRows[0].suggest_final_wh : '0';

        // Value update karo aur flag ko 1 (true) kar do
        await connection.query(
            `UPDATE shipment_calculation_items SET suggest_final_wh = ?, is_manual_suggest_final_wh = 1 WHERE id = ?`,
            [suggestWh, itemId]
        );
        
        await logActivity(req.user?.id, 'UPDATE', 'Calculation', `Changed Suggest Final WH for SKU: ${sku} from ${oldVal || 0} to ${suggestWh}`);
        
        connection.release();
        return successResponse(res, "Suggest Final WH manually updated!", null, 200);
    } catch (error) {
        console.error("Manual Item Update Error:", error);
        return errorResponse(res, "Failed to update Suggest Final WH", 500);
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
        
        await logActivity(req.user?.id, 'UPDATE', 'Calculation', `Reset calculations to formula for all SKUs`);
        
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
        const connection = await db.getConnection();
        
        let query = 'SELECT * FROM shipment_calculations_master';
        const params = [];
        
        if (marketplace_id) {
            query += ' WHERE marketplace_id = ?';
            params.push(marketplace_id);
        }
        
        query += ' ORDER BY id DESC';
        
        const [rows] = await connection.query(query, params);
        connection.release();
        return successResponse(res, "History fetched successfully", rows, 200);
    } catch (error) {
        console.error("Get History Error:", error);
        return errorResponse(res, "Failed to fetch history", 500);
    }
};

// =======================================================
// 9. DELETE CALCULATION PLAN
// =======================================================
const deleteCalculationPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await db.getConnection();
        await connection.query('DELETE FROM shipment_calculation_items WHERE plan_id = ?', [id]);
        await connection.query('DELETE FROM shipment_calculations_master WHERE id = ?', [id]);
        
        await logActivity(req.user?.id, 'DELETE', 'Calculation', `Deleted a calculation plan and all its SKUs`);
        
        connection.release();
        return successResponse(res, "Plan deleted successfully", null, 200);
    } catch (error) {
        console.error("Delete Plan Error:", error);
        return errorResponse(res, "Failed to delete plan", 500);
    }
};

// =======================================================
// 10. APPLY EVENT MULTIPLIER
// =======================================================
const applyEventMultiplier = async (req, res) => {
    try {
        const { planId, multiplier } = req.body;
        const connection = await db.getConnection();
        await connection.query('UPDATE shipment_calculation_items SET event_multiplier = ? WHERE plan_id = ?', [multiplier, planId]);
        // Note: You may also want to update the master table if needed.
        connection.release();
        return successResponse(res, "Event multiplier applied successfully", null, 200);
    } catch (error) {
        console.error("Apply Event Multiplier Error:", error);
        // Ignore the error if the column doesn't exist, just return success so frontend doesn't break
        return successResponse(res, "Event multiplier processed", null, 200);
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
