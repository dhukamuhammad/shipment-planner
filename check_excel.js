const path = require('path');
const ExcelJS = require(path.join(__dirname, 'server', 'node_modules', 'exceljs'));

async function checkFile() {
    const filePath = 'C:\\Users\\HP\\Downloads\\Calculation_Template (7).xlsx';
    console.log("Checking file:", filePath);
    
    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
        styles: 'ignore', sharedStrings: 'cache', hyperlinks: 'ignore', worksheets: 'emit'
    });
    
    for await (const worksheet of workbookReader) {
        console.log("Sheet:", worksheet.name);
        for await (const row of worksheet) {
            let rowData = [];
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                rowData[colNumber] = cell.value;
            });
            console.log("Row:", rowData.slice(1, 10)); // print first few columns
            break; // just print first row
        }
    }
}

checkFile().catch(console.error);
