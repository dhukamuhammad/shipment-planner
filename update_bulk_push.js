const fs = require('fs');
const filepath = 'server/controller/calculation/calculation.js';
let content = fs.readFileSync(filepath, 'utf8');

const search = `sanitizeNumber(row["Available Qty"]),
                ixdFulfilmentJSON,`;
const replace = `sanitizeNumber(row["Available Qty"]),
                ixdFulfilmentJSON,
                whFulfilmentJSON,`;

if (content.includes(search)) {
    content = content.replace(search, replace);
}

fs.writeFileSync(filepath, content);
console.log('Fixed bulkValues.push');
