const fs = require('fs');
let code = fs.readFileSync('server/controller/calculation/calculation.js', 'utf8');

code = code.replace(/transitQtyMap\[r\.merchant_sku\] = Number\(r\.total_qty\) \|\| 0;/g, 'transitQtyMap[r.merchant_sku] = r.total_qty;');
code = code.replace(/dihQtyMap\[r\.msku\] = Number\(r\.total_ending_balance\) \|\| 0;/g, 'dihQtyMap[r.msku] = r.total_ending_balance;');
code = code.replace(/businessQtyMap\[r\.sku\] = Number\(r\.total_units_ordered\) \|\| 0;/g, 'businessQtyMap[r.sku] = r.total_units_ordered;');
code = code.replace(/const qty = Number\(r\.total_shipped_qty\) \|\| 0;/g, 'const qty = r.total_shipped_qty || 0;');
code = code.replace(/const avgQty = Number\(r\.total_qty\) \/ count;/g, 'const avgQty = r.total_qty / count;');

fs.writeFileSync('server/controller/calculation/calculation.js', code);
console.log('Reverted bugs successfully');
