const fs = require('fs');
const ExcelJS = require('exceljs');
const path = require('path');
const db = require('./config/db');
const { uploadCalculationReport } = require('./controller/calculation/calculation');

async function testUpload() {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Template');
        sheet.addRow(['Group Name', 'SKU', 'Title', 'Category', 'HSN', 'GST', 'Cost', 'Weight', 'MRP', 'FNSKU', 'shipment_packaging', 'Length (L)', 'Width (W)', 'Height (H)', 'Dimension Unit']);
        sheet.addRow(['Grp1', 'SKU123', 'My Title', 'Cat1', '1234', '18', '100', '1.5', '200', 'FN123', 'box', '10', '10', '10', 'cm']);
        await workbook.xlsx.writeFile('test_template3.xlsx');
        console.log('Created test_template3.xlsx');

        const req = {
            file: {
                originalname: 'test_template3.xlsx',
                path: 'test_template3.xlsx',
                size: 5000,
                filename: 'test_template3.xlsx'
            },
            body: {
                marketplace_id: 1
            }
        };
        
        const res = {
            status: function(code) { this.statusCode = code; return this; },
            json: function(data) { console.log('Response JSON:', data); }
        };

        await uploadCalculationReport(req, res);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
testUpload();
