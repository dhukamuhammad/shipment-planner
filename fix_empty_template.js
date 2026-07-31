const fs = require('fs');

const filepath = 'server/controller/calculation/calculation.js';
let content = fs.readFileSync(filepath, 'utf8');

const searchEmpty = `        if (rawRows.length === 0) throw new Error("File is empty!");`;
const replaceEmpty = `        if (rawRows.length === 0) {
            if (ixdWarehouses.length > 0 || regularWarehouses.length > 0) {
                connection.release();
                return successResponse(res, "Warehouses updated successfully. No calculation data found.", {
                    message: "Warehouses extracted and updated.",
                    warehouses: { ixd: ixdWarehouses, warehouse: regularWarehouses }
                }, 200);
            }
            throw new Error("File is empty!");
        }`;

if (content.includes(searchEmpty)) {
    content = content.replace(searchEmpty, replaceEmpty);
}

const searchHeaderError = `        if (headerRowIndex === -1) {
            throw new Error("Invalid file! 'Group Name' ya 'SKU' header nahi mila. Please format check karein.");
        }`;
const replaceHeaderError = `        if (headerRowIndex === -1) {
            if (ixdWarehouses.length > 0 || regularWarehouses.length > 0) {
                connection.release();
                return successResponse(res, "Warehouses updated successfully. No calculation data found.", {
                    message: "Warehouses extracted and updated.",
                    warehouses: { ixd: ixdWarehouses, warehouse: regularWarehouses }
                }, 200);
            }
            throw new Error("Invalid file! 'Group Name' ya 'SKU' header nahi mila. Please format check karein.");
        }`;

if (content.includes(searchHeaderError)) {
    content = content.replace(searchHeaderError, replaceHeaderError);
}

fs.writeFileSync(filepath, content);
console.log("Empty sheet exception handled!");
