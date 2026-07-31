const fs = require('fs');

const filepath = 'server/controller/calculation/calculation.js';
let content = fs.readFileSync(filepath, 'utf8');

const searchEmptyRows = `        if (rawRows.length === 0) {
            if (ixdWarehouses.length > 0 || regularWarehouses.length > 0) {
                connection.release();
                return successResponse(res, "Warehouses updated successfully. No calculation data found.", {
                    message: "Warehouses extracted and updated.",
                    warehouses: { ixd: ixdWarehouses, warehouse: regularWarehouses }
                }, 200);
            }
            throw new Error("File is empty!");
        }`;

const replaceEmptyRows = `        if (rawRows.length === 0) {
            if (ixdWarehouses.length > 0 || regularWarehouses.length > 0) {
                await connection.query("DELETE FROM shipment_calculations_master WHERE id = ?", [planId]);
                await connection.query("DELETE FROM uploaded_reports WHERE id = ?", [reportId]);
                await connection.commit();
                connection.release();
                return successResponse(res, "Warehouses updated successfully. No calculation data found.", {
                    message: "Warehouses extracted and updated.",
                    warehouses: { ixd: ixdWarehouses, warehouse: regularWarehouses }
                }, 200);
            }
            throw new Error("File is empty!");
        }`;

if (content.includes(searchEmptyRows)) {
    content = content.replace(searchEmptyRows, replaceEmptyRows);
}

const searchHeaderError = `        if (headerRowIndex === -1) {
            if (ixdWarehouses.length > 0 || regularWarehouses.length > 0) {
                connection.release();
                return successResponse(res, "Warehouses updated successfully. No calculation data found.", {
                    message: "Warehouses extracted and updated.",
                    warehouses: { ixd: ixdWarehouses, warehouse: regularWarehouses }
                }, 200);
            }
            throw new Error("Invalid file! 'Group Name' ya 'SKU' header nahi mila. Please format check karein.");
        }`;

const replaceHeaderError = `        if (headerRowIndex === -1) {
            if (ixdWarehouses.length > 0 || regularWarehouses.length > 0) {
                await connection.query("DELETE FROM shipment_calculations_master WHERE id = ?", [planId]);
                await connection.query("DELETE FROM uploaded_reports WHERE id = ?", [reportId]);
                await connection.commit();
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

const searchRawDataEnd = `        // --- STEP 4: PREPARE BULK VALUES FOR DB ---`;
const replaceRawDataEnd = `        if (rawData.length === 0) {
            // Agar data nahi hai (only headers thi ya blank thi), toh newly created plan ko delete kar do
            await connection.query("DELETE FROM shipment_calculations_master WHERE id = ?", [planId]);
            await connection.query("DELETE FROM uploaded_reports WHERE id = ?", [reportId]);
            await connection.commit();
            
            if (ixdWarehouses.length > 0 || regularWarehouses.length > 0) {
                connection.release();
                return successResponse(res, "Warehouses updated successfully. No calculation data found.", {
                    message: "Warehouses extracted and updated.",
                    warehouses: { ixd: ixdWarehouses, warehouse: regularWarehouses }
                }, 200);
            } else {
                throw new Error("File has no valid calculation data rows!");
            }
        }

        // --- STEP 4: PREPARE BULK VALUES FOR DB ---`;

if (content.includes(searchRawDataEnd) && !content.includes("File has no valid calculation data rows!")) {
    content = content.replace(searchRawDataEnd, replaceRawDataEnd);
}

fs.writeFileSync(filepath, content);
console.log("Fixed empty calculation data plan insertion bug");
