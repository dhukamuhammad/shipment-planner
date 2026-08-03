const fs = require('fs');
const ExcelJS = require('exceljs');
const { uploadCalculationReport } = require('./controller/calculation/calculation');
const db = require('./config/db');

async function test() {
    const req = {
        file: {
            size: 1024,
            originalname: 'test.xlsx',
            filename: 'test_file_fake.xlsx',
            path: 'test_file_fake.xlsx'
        },
        body: {
            marketplace_id: 1,
            shipment_mode: 'FC'
        }
    };
    const res = {
        status: (c) => ({ json: (data) => console.log('Response:', c, data) })
    };
    // Create a fake excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Calculation');
    sheet.addRow(['Group Name', 'SKU', 'Title', 'Category', 'Int – WH', 'Dec – WH', 'Non Apron Qty', 'Sale-Total', 'Sale-WH', 'Ship – WH', 'Sum', 'Final – WH', 'MRP', 'FNSKU', 'Length (L)', 'Width (W)', 'Height (H)', 'Dimension Unit', 'shipment_packaging']);
    sheet.addRow(['Apron', 'Apron_Black', 'Apron Black', 'Kitchen', 0, 0, 0, 10, 5, 2, 0, 2, 100, 'FNSKU1', 10, 10, 10, 'cm', 'poly']);
    await workbook.xlsx.writeFile('test_file_fake.xlsx');
    
    try {
        await uploadCalculationReport(req, res);
    } catch (e) {
        console.error('Error:', e);
    }
    process.exit(0);
}
test();
