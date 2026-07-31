const fs = require('fs');

const filepath = 'server/controller/calculation/calculation.js';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Fetch marketplaceName
const searchMarketplaceId = `            if (!marketplace_id) throw new Error("Marketplace ID is required!");`;
const replaceMarketplaceId = `            if (!marketplace_id) throw new Error("Marketplace ID is required!");

            const [mpRows] = await connection.query("SELECT name FROM marketplaces WHERE id = ?", [marketplace_id]);
            const marketplaceName = mpRows.length > 0 ? mpRows[0].name.toLowerCase().trim() : "";`;

if (content.includes(searchMarketplaceId) && !content.includes('SELECT name FROM marketplaces WHERE id = ?')) {
    content = content.replace(searchMarketplaceId, replaceMarketplaceId);
}

// 2. Rewrite Excel parsing to extract IXD and Warehouse
const searchExcelParse = `        if (fileExt === '.csv') {
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
        }`;

const replaceExcelParse = `        let ixdWarehouses = [];
        let regularWarehouses = [];

        if (fileExt === '.csv') {
            rawRows = await parseCsvRaw(req.file.path);
        } else {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(req.file.path);
            
            let mainWorksheet = null;
            let ixdWorksheet = null;
            let whWorksheet = null;

            // Find sheets
            workbook.worksheets.forEach(ws => {
                const wsName = ws.name.toLowerCase().trim();
                if (wsName === 'ixd') {
                    ixdWorksheet = ws;
                } else if (wsName === 'warehouse' || wsName === 'warehouse ') {
                    whWorksheet = ws;
                } else if (!mainWorksheet && ws.rowCount > 0) {
                    mainWorksheet = ws;
                }
            });
            
            // Prefer explicitly named Template sheet
            const templateSheet = workbook.getWorksheet('Template');
            if (templateSheet && templateSheet.rowCount > 0) {
                mainWorksheet = templateSheet;
            }

            if (!mainWorksheet) throw new Error("No data found in any sheet.");

            mainWorksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
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

            // Extract IXD Warehouses
            if (ixdWorksheet && marketplaceName) {
                let targetColIdx = -1;
                const headerRow = ixdWorksheet.getRow(1);
                
                if (headerRow) {
                    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        if (cell.value && cell.value.toString().toLowerCase().trim() === marketplaceName) {
                            targetColIdx = colNumber;
                        }
                    });
                }
                
                if (targetColIdx !== -1) {
                    ixdWorksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
                        if (rowNumber === 1) return; // skip header
                        const cell = row.getCell(targetColIdx);
                        if (cell && cell.value) {
                            const val = cell.value.toString().trim();
                            if (val) {
                                ixdWarehouses.push(val);
                            }
                        }
                    });
                }
                
                if (ixdWarehouses.length > 0) {
                    for (let wh of ixdWarehouses) {
                        await connection.query("INSERT IGNORE INTO ixd_warehouses (marketplace_id, name, type) VALUES (?, ?, 'IXD')", [marketplace_id, wh]);
                    }
                }
            }

            // Extract Regular Warehouses
            if (whWorksheet && marketplaceName) {
                let targetColIdx = -1;
                const headerRow = whWorksheet.getRow(1);
                
                if (headerRow) {
                    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        if (cell.value && cell.value.toString().toLowerCase().trim() === marketplaceName) {
                            targetColIdx = colNumber;
                        }
                    });
                }
                
                if (targetColIdx !== -1) {
                    whWorksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
                        if (rowNumber === 1) return; // skip header
                        const cell = row.getCell(targetColIdx);
                        if (cell && cell.value) {
                            const val = cell.value.toString().trim();
                            if (val) {
                                regularWarehouses.push(val);
                            }
                        }
                    });
                }
                
                if (regularWarehouses.length > 0) {
                    for (let wh of regularWarehouses) {
                        await connection.query("INSERT IGNORE INTO ixd_warehouses (marketplace_id, name, type) VALUES (?, ?, 'Warehouse')", [marketplace_id, wh]);
                    }
                }
            }
        }`;

if (content.includes(searchExcelParse)) {
    content = content.replace(searchExcelParse, replaceExcelParse);
} else {
    console.log("Could not find excel parse block");
}

// 3. Define ixdFulfilmentJSON and whFulfilmentJSON before bulkValues
const searchBulk = `        const bulkValues = [];
        rawData.forEach((row) => {`;
const replaceBulk = `        const ixdFulfilmentJSON = ixdWarehouses.length > 0 ? JSON.stringify(ixdWarehouses) : null;
        const whFulfilmentJSON = regularWarehouses.length > 0 ? JSON.stringify(regularWarehouses) : null;
        
        const bulkValues = [];
        rawData.forEach((row) => {`;

if (content.includes(searchBulk)) {
    content = content.replace(searchBulk, replaceBulk);
} else {
    console.log("Could not find bulkValues block");
}

// 4. Update Fulfilment ID push to bulkValues
// In the original file, it was:
//                 sanitizeNumber(row["Available Qty"]),
//                 row["Fulfilment ID"] || 'BLR4',
// Wait, is it `row["Fulfilment ID"] || 'BLR4',` ? Let's replace it with regex to be safe.

const searchFulfilment = `sanitizeNumber(row["Available Qty"]),
                row["Fulfilment ID"] || 'BLR4',`;
const replaceFulfilment = `sanitizeNumber(row["Available Qty"]),
                ixdFulfilmentJSON, // ixd
                whFulfilmentJSON, // warehouse`;

if (content.includes(searchFulfilment)) {
    content = content.replace(searchFulfilment, replaceFulfilment);
} else {
    // try finding just row["Fulfilment ID"]
    content = content.replace(/row\["Fulfilment ID"\] \|\| 'BLR4',/g, 'ixdFulfilmentJSON, whFulfilmentJSON,');
}

// 5. Replace `fulfilment_id` in SQL insert statements with `ixd_fulfilment_id, warehouse_fulfilment_id`
const searchInsertBulk = `tra_qty, quantity, available_qty, fulfilment_id, `;
const replaceInsertBulk = `tra_qty, quantity, available_qty, ixd_fulfilment_id, warehouse_fulfilment_id, `;
content = content.replace(new RegExp(searchInsertBulk, 'g'), replaceInsertBulk);

const searchInsertManual = `ref_sku, ref_title, fulfilment_id,`;
const replaceInsertManual = `ref_sku, ref_title, ixd_fulfilment_id, warehouse_fulfilment_id,`;
content = content.replace(new RegExp(searchInsertManual, 'g'), replaceInsertManual);

const searchInsertManual2 = `ref_sku, ref_title, fulfilment_id`;
const replaceInsertManual2 = `ref_sku, ref_title, ixd_fulfilment_id, warehouse_fulfilment_id`;
content = content.replace(new RegExp(searchInsertManual2, 'g'), replaceInsertManual2);


// Add the extra `?` in VALUES for bulk insertion
// The bulk insertion query:
//            INSERT INTO shipment_calculation_items (
//                plan_id, report_id, marketplace_id, group_name, sku, title, category, 
//                int_wh, dec_wh, non_apron_qty, 
//                apr_sky_blue, apr_dark_blue, apr_brown, apr_green, apr_tan, apr_black, apr_red, apr_grey, 
//                weight, total_weight, hsn, gst, cost, 
//                ref_sku, ref_title, tra_qty, quantity, available_qty, fulfilment_id, 
//                sale_total, sale_wh, ship_wh, sum_val, final_wh, shipment_packaging
//            ) VALUES ?
// It doesn't use `?` count. 

// The manual insertion query:
//            INSERT INTO shipment_calculation_items (
//                plan_id, report_id, group_name, sku, title, category, 
//                hsn, gst, cost, weight,
//                ref_sku, ref_title, fulfilment_id,
//                packing_dimension_length, packing_dimension_width, packing_dimension_height, packing_dimension_unit
//            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
const searchValuesManual = `) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
const replaceValuesManual = `) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`; // added one ?
if (content.includes(searchValuesManual)) {
    content = content.replace(searchValuesManual, replaceValuesManual);
} else {
    // try different count
    content = content.replace(/\) VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?\)/g, ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
}

const searchParamsManual = `            data.title || null,
            fcId,

            data.length || 0,`;
const replaceParamsManual = `            data.title || null,
            fcId, // ixd
            null, // warehouse

            data.length || 0,`;
if (content.includes(searchParamsManual)) {
    content = content.replace(searchParamsManual, replaceParamsManual);
}

fs.writeFileSync(filepath, content);
console.log('Fixed calculation.js from scratch!');
