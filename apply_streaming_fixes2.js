const fs = require('fs');

const filepath = 'server/controller/calculation/calculation.js';
let content = fs.readFileSync(filepath, 'utf8');

// Normalize newlines
content = content.replace(/\r\n/g, '\n');

// 1. Fetch marketplaceName early
const searchMarketplaceId = `            if (!marketplace_id) throw new Error("Marketplace ID is required!");`;
const replaceMarketplaceId = `            if (!marketplace_id) throw new Error("Marketplace ID is required!");

            const [mpRows] = await connection.query("SELECT name FROM marketplaces WHERE id = ?", [marketplace_id]);
            const marketplaceName = mpRows.length > 0 ? mpRows[0].name.toLowerCase().trim() : "";`;

if (content.includes(searchMarketplaceId) && !content.includes('SELECT name FROM marketplaces WHERE id = ?')) {
    content = content.replace(searchMarketplaceId, replaceMarketplaceId);
}

// 2. Rewrite Excel parsing to handle streaming multiple sheets
const searchExcelParseStart = `        if (fileExt === '.csv') {`;
const searchExcelParseEnd = `        console.timeEnd("⏳ Calculation File Parsing");`;

const startIdx = content.indexOf(searchExcelParseStart);
const endIdx = content.indexOf(searchExcelParseEnd);

if (startIdx !== -1 && endIdx !== -1) {
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
        }
`;
    content = content.substring(0, startIdx) + replaceExcelParse + content.substring(endIdx);
} else {
    console.log("Could not find excel parse block bounds");
}

// 3. Define ixdFulfilmentJSON and whFulfilmentJSON before bulkValues
const searchBulk = `        const bulkValues = [];\n        rawData.forEach((row) => {`;
const replaceBulk = `        const ixdFulfilmentJSON = ixdWarehouses && ixdWarehouses.length > 0 ? JSON.stringify(ixdWarehouses) : null;
        const whFulfilmentJSON = regularWarehouses && regularWarehouses.length > 0 ? JSON.stringify(regularWarehouses) : null;
        
        const bulkValues = [];
        rawData.forEach((row) => {`;

if (content.includes(searchBulk)) {
    content = content.replace(searchBulk, replaceBulk);
} else {
    console.log("Could not find bulkValues block");
    content = content.replace(/const bulkValues = \[\];\n\s*rawData\.forEach\(\(row\) => \{/g, replaceBulk);
}

// 4. Update Fulfilment ID push to bulkValues
// In the original file it might be:
// sanitizeNumber(row["Available Qty"]),
// row["Fulfilment ID"] || 'BLR4',

content = content.replace(/sanitizeNumber\(row\["Available Qty"\]\),\n\s*row\["Fulfilment ID"\] \|\| 'BLR4',/g, 'sanitizeNumber(row["Available Qty"]),\n                ixdFulfilmentJSON,\n                whFulfilmentJSON,');
// Try generic replace if previous failed
if (content.includes(`row["Fulfilment ID"] || 'BLR4',`)) {
    content = content.replace(`row["Fulfilment ID"] || 'BLR4',`, 'ixdFulfilmentJSON,\n                whFulfilmentJSON,');
}

// 5. Replace SQL insert column statements
content = content.replace(/tra_qty, quantity, available_qty, fulfilment_id,/g, 'tra_qty, quantity, available_qty, ixd_fulfilment_id, warehouse_fulfilment_id,');
content = content.replace(/ref_sku, ref_title, fulfilment_id,/g, 'ref_sku, ref_title, ixd_fulfilment_id, warehouse_fulfilment_id,');
content = content.replace(/ref_sku, ref_title, fulfilment_id/g, 'ref_sku, ref_title, ixd_fulfilment_id, warehouse_fulfilment_id');

// Replace Values count for manual insert
const searchManualQ = `            INSERT INTO shipment_calculation_items (
                plan_id, report_id, group_name, sku, title, category, 
                hsn, gst, cost, weight, mrp, fnsku,
                ref_sku, ref_title, ixd_fulfilment_id, warehouse_fulfilment_id, shipment_packaging,
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
    // Just replace 20 placeholders with 21.
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
console.log('Fixed calculation.js streaming robustly!');
