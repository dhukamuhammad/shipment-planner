const fs = require('fs');
const filepath = 'server/controller/calculation/calculation.js';
let content = fs.readFileSync(filepath, 'utf8');

const search = `                sanitizeNumber(row["Available Qty"]),
                row["Fulfilment ID"] || null,`;

const replace = `                sanitizeNumber(row["Available Qty"]),
                ixdFulfilmentJSON,
                whFulfilmentJSON,`;

if (content.includes(search)) {
    content = content.replace(search, replace);
} else {
    // try finding just Fulfilment ID
    content = content.replace(/row\["Fulfilment ID"\] \|\| null,/g, 'ixdFulfilmentJSON,\n                whFulfilmentJSON,');
}

fs.writeFileSync(filepath, content);
console.log('Fixed Fulfilment ID push');
