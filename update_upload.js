const fs = require('fs');

const filepath = 'server/controller/calculation/calculation.js';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Get marketplaceName inside uploadCalculationReport
const searchMarketplaceId = `            if (!marketplace_id) throw new Error("Marketplace ID is required!");`;
const replaceMarketplaceId = `            if (!marketplace_id) throw new Error("Marketplace ID is required!");

            const [mpRows] = await connection.query("SELECT name FROM marketplaces WHERE id = ?", [marketplace_id]);
            const marketplaceName = mpRows.length > 0 ? mpRows[0].name.toLowerCase().trim() : "";`;

if (content.includes(searchMarketplaceId) && !content.includes('SELECT name FROM marketplaces WHERE id = ?')) {
    content = content.replace(searchMarketplaceId, replaceMarketplaceId);
}

// 2. Modify Excel Parsing
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
        if (fileExt === '.csv') {
            rawRows = await parseCsvRaw(req.file.path);
        } else {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(req.file.path);
            
            let mainWorksheet = null;
            let ixdWorksheet = null;

            // Find sheets
            workbook.worksheets.forEach(ws => {
                const wsName = ws.name.toLowerCase();
                if (wsName === 'ixd') {
                    ixdWorksheet = ws;
                } else if (!mainWorksheet && ws.rowCount > 0 && wsName !== 'warehouse') {
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
                
                headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    if (cell.value && cell.value.toString().toLowerCase().trim() === marketplaceName) {
                        targetColIdx = colNumber;
                    }
                });
                
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
                        await connection.query("INSERT IGNORE INTO ixd_warehouses (marketplace_id, name) VALUES (?, ?)", [marketplace_id, wh]);
                    }
                }
            }
        }`;

if (content.includes(searchExcelParse)) {
    content = content.replace(searchExcelParse, replaceExcelParse);
} else {
    console.log("Could not find excel parse block.");
}

// 3. Add to bulk insertion
// Let's find: `if (parsedPackaging.length > 0) { shipmentPackagingJSON = JSON.stringify(parsedPackaging); } }`
// We'll append `const ixdFulfilmentJSON = ixdWarehouses.length > 0 ? JSON.stringify(ixdWarehouses) : null;`
const searchPackaging = `if (parsedPackaging.length > 0) {
                    shipmentPackagingJSON = JSON.stringify(parsedPackaging);
                }
            }`;
const replacePackaging = `if (parsedPackaging.length > 0) {
                    shipmentPackagingJSON = JSON.stringify(parsedPackaging);
                }
            }
            const ixdFulfilmentJSON = ixdWarehouses.length > 0 ? JSON.stringify(ixdWarehouses) : null;`;
            
if (content.includes(searchPackaging)) {
    content = content.replace(searchPackaging, replacePackaging);
}

// Now we need to update the bulkValue array push logic:
// `bulkValues.push([ planId, reportId, ... ])` - we need to make sure `ixdFulfilmentJSON` is placed where `ixd_fulfilment_id` is.
// Wait, `ixd_fulfilment_id` is passed as `null` or empty string previously. We should find where it is passed.
// `ref_title || null, traQty, quantity, availableQty, null, `
// Let's do a simple regex or string replacement for the bulkValues push block.
const searchBulkValuesPush = `                availableQty, // available_qty
                null, // ixd_fulfilment_id`;
const replaceBulkValuesPush = `                availableQty, // available_qty
                ixdFulfilmentJSON, // ixd_fulfilment_id`;

if (content.includes(searchBulkValuesPush)) {
    content = content.replace(searchBulkValuesPush, replaceBulkValuesPush);
}

fs.writeFileSync(filepath, content);
console.log('Updated server calculation code');
