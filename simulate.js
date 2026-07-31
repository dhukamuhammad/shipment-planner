const path = require('path');
const ExcelJS = require(path.join(__dirname, 'server', 'node_modules', 'exceljs'));

async function simulate() {
    const filePath = 'C:\\Users\\HP\\Downloads\\Calculation_Template (7).xlsx';
    
    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
        styles: 'ignore', sharedStrings: 'cache', hyperlinks: 'ignore', worksheets: 'emit'
    });
    
    let rawRows = [];
    let isFirstSheet = true;
    for await (const worksheet of workbookReader) {
        const wsName = worksheet.name ? worksheet.name.toLowerCase().trim() : '';
        
        if (wsName === 'ixd' || wsName === 'warehouse') {
            // ...
        } else if (wsName === 'template' || isFirstSheet) {
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
                isFirstSheet = false;
            }
        }
        if (wsName !== 'template') {
            isFirstSheet = false;
        }
    }
    
    let headerRowIndex = -1;
    for (let i = 0; i < rawRows.length; i++) {
        const currentRow = rawRows[i];
        if (!currentRow) continue;
        const isHeader = currentRow.some(cell => cell && cell.toString().toLowerCase().includes("group name"));
        if (isHeader) {
            headerRowIndex = i;
            break; 
        }
    }
    
    console.log("rawRows.length:", rawRows.length);
    if (rawRows.length > 0) {
        console.log("First row:", rawRows[0].slice(1, 4));
    }
    console.log("headerRowIndex:", headerRowIndex);
}

simulate().catch(console.error);
