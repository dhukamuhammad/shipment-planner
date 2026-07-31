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
                } else if (wsName === 'warehouse') {
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
const searchFulfilment = `sanitizeNumber(row["quantity"]),
                sanitizeNumber(row["Available Qty"]),
                row["Fulfilment ID"] || 'BLR4',`;
const replaceFulfilment = `sanitizeNumber(row["quantity"]),
                sanitizeNumber(row["Available Qty"]),
                ixdFulfilmentJSON, // ixd
                whFulfilmentJSON, // warehouse`;

if (content.includes(searchFulfilment)) {
    content = content.replace(searchFulfilment, replaceFulfilment);
} else {
    console.log("Could not find Fulfilment ID push logic");
}

// 5. Update INSERT queries
const searchInsertBulk = `tra_qty, quantity, available_qty, ixd_fulfilment_id, `;
const replaceInsertBulk = `tra_qty, quantity, available_qty, ixd_fulfilment_id, warehouse_fulfilment_id, `;
content = content.replace(new RegExp(searchInsertBulk, 'g'), replaceInsertBulk);

const searchInsertManual = `ref_sku, ref_title, ixd_fulfilment_id, shipment_packaging,`;
const replaceInsertManual = `ref_sku, ref_title, ixd_fulfilment_id, warehouse_fulfilment_id, shipment_packaging,`;
content = content.replace(new RegExp(searchInsertManual, 'g'), replaceInsertManual);

const searchValues = `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
const replaceValues = `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
content = content.replace(new RegExp(searchValues.replace(/[.*+?^$\{\}\(\)\|\[\]\\]/g, '\\$&'), 'g'), replaceValues);

const searchParams = `        const [result] = await connection.query(insertQuery, [
            data.planId,
            reportId,
            data.groupName,
            data.sku,
            data.title || null,
            data.category || null,
            
            data.hsn || null,
            data.gst || null,
            data.cost || 0,
            data.weight || 0,
            data.mrp || 0,
            data.fnsku || null,

            data.sku,
            data.title || null,
            fcId,
            shipmentPackagingJSON,

            data.length || 0,
            data.width || 0,
            data.height || 0,
            data.dimensionUnit || 'cm'
        ]);`;

const replaceParams = `        const [result] = await connection.query(insertQuery, [
            data.planId,
            reportId,
            data.groupName,
            data.sku,
            data.title || null,
            data.category || null,
            
            data.hsn || null,
            data.gst || null,
            data.cost || 0,
            data.weight || 0,
            data.mrp || 0,
            data.fnsku || null,

            data.sku,
            data.title || null,
            fcId, // ixd
            null, // warehouse
            shipmentPackagingJSON,

            data.length || 0,
            data.width || 0,
            data.height || 0,
            data.dimensionUnit || 'cm'
        ]);`;
if (content.includes(searchParams)) {
    content = content.replace(searchParams, replaceParams);
}

fs.writeFileSync(filepath, content);
console.log('Fixed calculation.js from scratch!');
