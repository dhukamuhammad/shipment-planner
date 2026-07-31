const fs = require('fs');

const filepath = 'server/controller/calculation/calculation.js';
let content = fs.readFileSync(filepath, 'utf8');

// Replace the worksheet discovery loop
const search1 = `            // Find sheets
            workbook.worksheets.forEach(ws => {
                const wsName = ws.name.toLowerCase();
                if (wsName === 'ixd') {
                    ixdWorksheet = ws;
                } else if (!mainWorksheet && ws.rowCount > 0 && wsName !== 'warehouse') {
                    mainWorksheet = ws;
                }
            });`;

const replace1 = `            // Find sheets
            workbook.worksheets.forEach(ws => {
                const wsName = ws.name.toLowerCase();
                if (wsName === 'ixd') {
                    ixdWorksheet = ws;
                } else if (wsName === 'warehouse' || wsName === 'warehouse ') {
                    whWorksheet = ws;
                } else if (!mainWorksheet && ws.rowCount > 0) {
                    mainWorksheet = ws;
                }
            });`;

if (content.includes(search1)) {
    content = content.replace(search1, replace1);
} else {
    console.log("Could not find search1");
}

// Add variable declaration
const search2 = `        let ixdWarehouses = [];`;
const replace2 = `        let ixdWarehouses = [];
        let regularWarehouses = [];`;

if (content.includes(search2) && !content.includes('let regularWarehouses = []')) {
    content = content.replace(search2, replace2);
}

// Add whWorksheet initialization
const search3 = `            let mainWorksheet = null;
            let ixdWorksheet = null;`;
const replace3 = `            let mainWorksheet = null;
            let ixdWorksheet = null;
            let whWorksheet = null;`;

if (content.includes(search3) && !content.includes('let whWorksheet = null;')) {
    content = content.replace(search3, replace3);
}

// Add the Warehouse extraction block after IXD extraction
const search4 = `                if (ixdWarehouses.length > 0) {
                    for (let wh of ixdWarehouses) {
                        await connection.query("INSERT IGNORE INTO ixd_warehouses (marketplace_id, name) VALUES (?, ?)", [marketplace_id, wh]);
                    }
                }
            }`;
const replace4 = `                if (ixdWarehouses.length > 0) {
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

if (content.includes(search4)) {
    content = content.replace(search4, replace4);
} else {
    console.log("Could not find search4");
}

fs.writeFileSync(filepath, content);
console.log('Fixed warehouse parsing logic');
