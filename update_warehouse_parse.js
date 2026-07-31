const fs = require('fs');

const filepath = 'server/controller/calculation/calculation.js';
let content = fs.readFileSync(filepath, 'utf8');

const searchExcelParse = `            let mainWorksheet = null;
            let ixdWorksheet = null;`;
const replaceExcelParse = `            let mainWorksheet = null;
            let ixdWorksheet = null;
            let whWorksheet = null;`;

const searchSheetLoop = `                if (wsName === 'ixd') {
                    ixdWorksheet = ws;
                } else if (!mainWorksheet && ws.rowCount > 0 && wsName !== 'warehouse') {
                    mainWorksheet = ws;
                }`;
const replaceSheetLoop = `                if (wsName === 'ixd') {
                    ixdWorksheet = ws;
                } else if (wsName === 'warehouse') {
                    whWorksheet = ws;
                } else if (!mainWorksheet && ws.rowCount > 0) {
                    mainWorksheet = ws;
                }`;

const searchWarehouseExtraction = `                if (ixdWarehouses.length > 0) {
                    for (let wh of ixdWarehouses) {
                        await connection.query("INSERT IGNORE INTO ixd_warehouses (marketplace_id, name) VALUES (?, ?)", [marketplace_id, wh]);
                    }
                }
            }`;
            
const replaceWarehouseExtraction = `                if (ixdWarehouses.length > 0) {
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
            }`;

const searchVarDeclaration = `        let ixdWarehouses = [];`;
const replaceVarDeclaration = `        let ixdWarehouses = [];
        let regularWarehouses = [];`;

if (content.includes(searchExcelParse)) content = content.replace(searchExcelParse, replaceExcelParse);
if (content.includes(searchSheetLoop)) content = content.replace(searchSheetLoop, replaceSheetLoop);
if (content.includes(searchWarehouseExtraction)) content = content.replace(searchWarehouseExtraction, replaceWarehouseExtraction);
if (content.includes(searchVarDeclaration)) content = content.replace(searchVarDeclaration, replaceVarDeclaration);

// 3. Add to bulk insertion
const searchBulkPrep = `        const ixdFulfilmentJSON = ixdWarehouses.length > 0 ? JSON.stringify(ixdWarehouses) : null;`;
const replaceBulkPrep = `        const ixdFulfilmentJSON = ixdWarehouses.length > 0 ? JSON.stringify(ixdWarehouses) : null;
        const whFulfilmentJSON = regularWarehouses.length > 0 ? JSON.stringify(regularWarehouses) : null;`;
if (content.includes(searchBulkPrep)) content = content.replace(searchBulkPrep, replaceBulkPrep);


// Find bulkValues push logic
const searchPushValues = `                sanitizeNumber(row["Available Qty"]),
                ixdFulfilmentJSON,`;
const replacePushValues = `                sanitizeNumber(row["Available Qty"]),
                ixdFulfilmentJSON,
                whFulfilmentJSON,`;
if (content.includes(searchPushValues)) content = content.replace(searchPushValues, replacePushValues);

fs.writeFileSync(filepath, content);
console.log('Updated server calculation code for Warehouse sheet parsing');
