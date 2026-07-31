const fs = require('fs');

const filepath = 'server/controller/calculation/calculation.js';
let content = fs.readFileSync(filepath, 'utf8');

// Define ixdFulfilmentJSON before bulkValues
const searchBulk = `        const bulkValues = [];
        rawData.forEach((row) => {`;
const replaceBulk = `        const ixdFulfilmentJSON = ixdWarehouses.length > 0 ? JSON.stringify(ixdWarehouses) : null;
        
        const bulkValues = [];
        rawData.forEach((row) => {`;

if (content.includes(searchBulk)) {
    content = content.replace(searchBulk, replaceBulk);
} else {
    console.log("Could not find bulkValues block");
}

// Replace Fulfilment ID logic
const searchFulfilment = `sanitizeNumber(row["quantity"]),
                sanitizeNumber(row["Available Qty"]),
                row["Fulfilment ID"] || 'BLR4',`;
const replaceFulfilment = `sanitizeNumber(row["quantity"]),
                sanitizeNumber(row["Available Qty"]),
                ixdFulfilmentJSON, // formerly row["Fulfilment ID"] || 'BLR4',`;

if (content.includes(searchFulfilment)) {
    content = content.replace(searchFulfilment, replaceFulfilment);
} else {
    console.log("Could not find Fulfilment ID logic");
}

fs.writeFileSync(filepath, content);
console.log('Updated Fulfilment ID logic in calculation.js');
