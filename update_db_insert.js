const fs = require('fs');

const filepath = 'server/controller/calculation/calculation.js';
let content = fs.readFileSync(filepath, 'utf8');

// Replace in INSERT INTO queries
const search1 = `tra_qty, quantity, available_qty, ixd_fulfilment_id, `;
const replace1 = `tra_qty, quantity, available_qty, ixd_fulfilment_id, warehouse_fulfilment_id, `;

const search2 = `ref_sku, ref_title, ixd_fulfilment_id, shipment_packaging,`;
const replace2 = `ref_sku, ref_title, ixd_fulfilment_id, warehouse_fulfilment_id, shipment_packaging,`;

// We also need to add an extra '?' in the VALUES clause
// For Line 331:
// `VALUES ?` is used, so we don't need to add `?`, it's an array of arrays!
// Wait, `bulkValues` uses bulk insert like: `connection.query("INSERT INTO ... VALUES ?", [chunk])`
// But what about the `UPDATE` statements or other single inserts?
// Let's check line 421. `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
// There are 37 `?`s, we need to make it 38 `?`s.

// Let's replace `search1` and `search2`
if (content.includes(search1)) {
    content = content.replace(new RegExp(search1, 'g'), replace1);
}
if (content.includes(search2)) {
    content = content.replace(new RegExp(search2, 'g'), replace2);
}

// Now replace the `VALUES (...)` for line 421 which is inside a loop of `missingMasterItems.map`
const searchValues = `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
const replaceValues = `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

if (content.includes(searchValues)) {
    content = content.replace(searchValues, replaceValues);
}

fs.writeFileSync(filepath, content);
console.log('Updated INSERT queries for warehouse_fulfilment_id');
