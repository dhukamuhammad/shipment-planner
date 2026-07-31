const db = require('./config/db');
const ExcelJS = require('exceljs');
const path = require('path');

async function restoreBasePlan() {
    try {
        const connection = await db.getConnection();
        const [reports] = await connection.query("SELECT * FROM uploaded_reports WHERE report_type = 'Calculation' AND marketplace_id = 1 ORDER BY uploaded_at DESC LIMIT 1");
        
        if (reports.length === 0) {
            console.log("No calculation report found");
            process.exit(1);
        }

        const report = reports[0];
        const filePath = path.join(__dirname, 'uploads', report.file_name);
        
        console.log("Restoring from:", filePath);
        
        const [masterResult] = await connection.query(
            `INSERT INTO shipment_calculations_master (report_id, status, marketplace_id) VALUES (?, 'Completed', ?)`,
            [report.id, 1]
        );
        const planId = masterResult.insertId;

        const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
            styles: 'ignore', sharedStrings: 'cache', hyperlinks: 'ignore', worksheets: 'emit'
        });

        let bulkValues = [];
        for await (const worksheetReader of workbookReader) {
            for await (const row of worksheetReader) {
                if (row.number === 1) continue; // Skip header

                const sku = row.getCell(3).value;
                if (!sku) continue; // Skip empty rows
                
                bulkValues.push([
                    planId, report.id, 1, 
                    row.getCell(2).value?.toString().trim() || null, // group_name
                    sku.toString().trim(), // sku
                    row.getCell(4).value?.toString().trim() || null, // title
                    row.getCell(5).value?.toString().trim() || null, // category
                    Number(row.getCell(6).value) || 0, // int_wh
                    Number(row.getCell(7).value) || 0, // dec_wh
                    Number(row.getCell(8).value) || 0, // non_apron_qty
                    Number(row.getCell(9).value) || 0, // apr_sky_blue
                    Number(row.getCell(10).value) || 0, // apr_dark_blue
                    Number(row.getCell(11).value) || 0, // apr_brown
                    Number(row.getCell(12).value) || 0, // apr_green
                    Number(row.getCell(13).value) || 0, // apr_tan
                    Number(row.getCell(14).value) || 0, // apr_black
                    Number(row.getCell(15).value) || 0, // apr_red
                    Number(row.getCell(16).value) || 0, // apr_grey
                    Number(row.getCell(17).value) || 0, // weight
                    Number(row.getCell(18).value) || 0, // total_weight
                    row.getCell(19).value?.toString().trim() || null, // hsn
                    Number(row.getCell(20).value) || null, // gst
                    Number(row.getCell(21).value) || 0, // cost
                    sku.toString().trim(), // ref_sku
                    row.getCell(4).value?.toString().trim() || null, // ref_title
                    0, 0, 0, // tra_qty, quantity, available_qty
                    'BLR4', // fulfilment_id
                    0, 0, 0, 0, 0, 1 // sale_total, sale_wh, ship_wh, sum_val, final_wh, is_active
                ]);
            }
        }

        if (bulkValues.length > 0) {
            const insertQuery = `
                INSERT INTO shipment_calculation_items (
                    plan_id, report_id, marketplace_id, group_name, sku, title, category, 
                    int_wh, dec_wh, non_apron_qty, 
                    apr_sky_blue, apr_dark_blue, apr_brown, apr_green, apr_tan, apr_black, apr_red, apr_grey, 
                    weight, total_weight, hsn, gst, cost, 
                    ref_sku, ref_title, tra_qty, quantity, available_qty, fulfilment_id, 
                    sale_total, sale_wh, ship_wh, sum_val, final_wh, is_active
                ) VALUES ?
            `;
            const CHUNK_SIZE = 500;
            for (let i = 0; i < bulkValues.length; i += CHUNK_SIZE) {
                const chunk = bulkValues.slice(i, i + CHUNK_SIZE);
                await connection.query(insertQuery, [chunk]);
            }
        }

        console.log("Restored plan with ID:", planId, "and", bulkValues.length, "items.");
        connection.release();
        process.exit(0);
    } catch (error) {
        console.error("Error restoring:", error);
        process.exit(1);
    }
}

restoreBasePlan();
