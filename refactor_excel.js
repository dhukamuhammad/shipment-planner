const fs = require('fs');

const filepath = 'server/controller/calculation/calculation.js';
let content = fs.readFileSync(filepath, 'utf8');

const search = `            const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(req.file.path, {
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
                                if (cell.value) {
                                    const cellStr = cell.value.toString().toLowerCase().trim();
                                    const mName = marketplaceName.toLowerCase().trim();
                                    if (cellStr === mName || (cellStr.includes('amazon') && mName.includes('amazon'))) {
                                        targetColIdx = colNumber;
                                    }
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
            }`;

const replace = `            const workbook = new ExcelJS.Workbook();
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
            }`;

if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync(filepath, content);
    console.log("Successfully replaced streaming with robust in-memory parsing");
} else {
    console.log("Could not find the streaming block to replace.");
}
