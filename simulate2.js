const path = require('path');
const ExcelJS = require(path.join(__dirname, 'server', 'node_modules', 'exceljs'));

async function simulate() {
    const filePath = 'C:\\Users\\HP\\Downloads\\Calculation_Template (7).xlsx';
    
    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
        styles: 'ignore', sharedStrings: 'cache', hyperlinks: 'ignore', worksheets: 'emit'
    });
    
    let rawRows = [];
    for await (const worksheet of workbookReader) {
        if (worksheet.name === 'Template') {
            for await (const row of worksheet) {
                let rowData = [];
                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    let val = cell.value;
                    if (val && typeof val === 'object') {
                        val = val.result !== undefined ? val.result : cell.text;
                    }
                    rowData[colNumber] = val !== undefined ? val : null;
                });
                rawRows.push(rowData);
                console.log("rowData[1]:", rowData[1], typeof rowData[1]);
                break;
            }
        }
    }
}

simulate().catch(console.error);
