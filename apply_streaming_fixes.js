const fs = require('fs');

const filepath = 'server/controller/calculation/calculation.js';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Fetch marketplaceName early
const searchMarketplaceId = `            if (!marketplace_id) throw new Error("Marketplace ID is required!");`;
const replaceMarketplaceId = `            if (!marketplace_id) throw new Error("Marketplace ID is required!");

            const [mpRows] = await connection.query("SELECT name FROM marketplaces WHERE id = ?", [marketplace_id]);
            const marketplaceName = mpRows.length > 0 ? mpRows[0].name.toLowerCase().trim() : "";`;

if (content.includes(searchMarketplaceId) && !content.includes('SELECT name FROM marketplaces WHERE id = ?')) {
    content = content.replace(searchMarketplaceId, replaceMarketplaceId);
}

// 2. Rewrite Excel parsing to handle streaming multiple sheets
const searchExcelParse = `        if (fileExt === '.csv') {
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
        }`;

const replaceExcelParse = `        let ixdWarehouses = [];
        let regularWarehouses = [];

        if (fileExt === '.csv') {
            rawRows = await parseCsvRaw(req.file.path);
        } else {
            const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(req.file.path, {
                styles: 'ignore', sharedStrings: 'cache', hyperlinks: 'ignore', worksheets: 'emit'
            });
            
            let isFirstSheet = true;
            for await (const worksheet of workbookReader) {
                const wsName = worksheet.name ? worksheet.name.toLowerCase().trim() : '';
                
                if (wsName === 'ixd' || wsName === 'warehouse') {
                    let targetColIdx = -1;
                    let isHeader = true;
                    for await (const row of worksheet) {
                        if (isHeader) {
                            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                                if (cell.value && cell.value.toString().toLowerCase().trim() === marketplaceName) {
                                    targetColIdx = colNumber;
                                }
                            });
                            isHeader = false;
                            continue;
                        }
                        
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
                } else if (wsName === 'template' || isFirstSheet) {
                    // Extract data rows
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
                    if (wsName === 'template') {
                        isFirstSheet = false; // We found the explicitly named Template sheet, ignore others if they come first
                    }
                }
                if (wsName !== 'template') {
                    isFirstSheet = false;
                }
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
        }`;

if (content.includes(searchExcelParse)) {
    content = content.replace(searchExcelParse, replaceExcelParse);
} else {
    console.log("Could not find excel parse block");
}

// 3. Define ixdFulfilmentJSON and whFulfilmentJSON before bulkValues
const searchBulk = `        const bulkValues = [];
        rawData.forEach((row) => {`;
const replaceBulk = `        const ixdFulfilmentJSON = ixdWarehouses && ixdWarehouses.length > 0 ? JSON.stringify(ixdWarehouses) : null;
        const whFulfilmentJSON = regularWarehouses && regularWarehouses.length > 0 ? JSON.stringify(regularWarehouses) : null;
        
        const bulkValues = [];
        rawData.forEach((row) => {`;

if (content.includes(searchBulk)) {
    content = content.replace(searchBulk, replaceBulk);
} else {
    console.log("Could not find bulkValues block");
}

// 4. Update Fulfilment ID push to bulkValues
// In the original streaming version, it looks like this:
//                 sanitizeNumber(row["Available Qty"]),
//                 row["Fulfilment ID"] || 'BLR4',

const searchFulfilment = `sanitizeNumber(row["Available Qty"]),
                row["Fulfilment ID"] || 'BLR4',`;
const replaceFulfilment = `sanitizeNumber(row["Available Qty"]),
                ixdFulfilmentJSON, // ixd
                whFulfilmentJSON, // warehouse`;

if (content.includes(searchFulfilment)) {
    content = content.replace(searchFulfilment, replaceFulfilment);
} else {
    console.log("Could not find Fulfilment ID push logic");
    content = content.replace(/row\["Fulfilment ID"\] \|\| 'BLR4',/g, 'ixdFulfilmentJSON, whFulfilmentJSON,');
}

// 5. Replace `fulfilment_id` in SQL insert statements with `ixd_fulfilment_id, warehouse_fulfilment_id`
// In the original file, it is:
// tra_qty, quantity, available_qty, fulfilment_id, 
// sale_total, sale_wh, ship_wh, sum_val, final_wh, shipment_packaging

const searchInsertBulk = `tra_qty, quantity, available_qty, fulfilment_id,`;
const replaceInsertBulk = `tra_qty, quantity, available_qty, ixd_fulfilment_id, warehouse_fulfilment_id,`;
content = content.replace(new RegExp(searchInsertBulk, 'g'), replaceInsertBulk);

const searchInsertManual = `ref_sku, ref_title, fulfilment_id, shipment_packaging,`;
const replaceInsertManual = `ref_sku, ref_title, ixd_fulfilment_id, warehouse_fulfilment_id, shipment_packaging,`;
content = content.replace(new RegExp(searchInsertManual, 'g'), replaceInsertManual);

const searchInsertManual2 = `ref_sku, ref_title, fulfilment_id`;
const replaceInsertManual2 = `ref_sku, ref_title, ixd_fulfilment_id, warehouse_fulfilment_id`;
content = content.replace(new RegExp(searchInsertManual2, 'g'), replaceInsertManual2);

// Add the extra `?` in VALUES for bulk insertion
// Wait, bulk insertion doesn't have `VALUES (?, ?, ...)`, it uses `VALUES ?`
// But manual insertion has `VALUES (?, ?, ...)`
const searchValuesManual = `) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
const replaceValuesManual = `) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`; // if there were 18, make it 19
if (content.includes(`(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)) {
    // maybe 20
}
// Actually, let's use a regex to find the exact manual insert query and replace it cleanly.
// The manual insert in the 675 line file looks like:
/*
        const insertQuery = `
            INSERT INTO shipment_calculation_items (
                plan_id, report_id, group_name, sku, title, category, 
                hsn, gst, cost, weight, mrp, fnsku,
                ref_sku, ref_title, fulfilment_id, shipment_packaging,
                packing_dimension_length, packing_dimension_width, packing_dimension_height, packing_dimension_unit
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
*/
const searchManualQ = `            INSERT INTO shipment_calculation_items (
                plan_id, report_id, group_name, sku, title, category, 
                hsn, gst, cost, weight, mrp, fnsku,
                ref_sku, ref_title, fulfilment_id, shipment_packaging,
                packing_dimension_length, packing_dimension_width, packing_dimension_height, packing_dimension_unit
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
const replaceManualQ = `            INSERT INTO shipment_calculation_items (
                plan_id, report_id, group_name, sku, title, category, 
                hsn, gst, cost, weight, mrp, fnsku,
                ref_sku, ref_title, ixd_fulfilment_id, warehouse_fulfilment_id, shipment_packaging,
                packing_dimension_length, packing_dimension_width, packing_dimension_height, packing_dimension_unit
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

if (content.includes(searchManualQ)) {
    content = content.replace(searchManualQ, replaceManualQ);
} else {
    // Try to just add a ? and replace column names
    content = content.replace(/ref_sku, ref_title, fulfilment_id, shipment_packaging,/g, 'ref_sku, ref_title, ixd_fulfilment_id, warehouse_fulfilment_id, shipment_packaging,');
    // We will do a generic ? replacement if it has exactly 20 question marks.
    content = content.replace(/\) VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?\)/g, ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
}


const searchParamsManual = `            data.title || null,
            fcId,
            shipmentPackagingJSON,`;
const replaceParamsManual = `            data.title || null,
            fcId, // ixd
            null, // warehouse
            shipmentPackagingJSON,`;
if (content.includes(searchParamsManual)) {
    content = content.replace(searchParamsManual, replaceParamsManual);
}

fs.writeFileSync(filepath, content);
console.log('Fixed calculation.js from scratch!');
