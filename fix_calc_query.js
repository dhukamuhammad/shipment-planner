const fs = require('fs');
let code = fs.readFileSync('server/controller/calculation/calculation.js', 'utf8');

const search = `        const [items] = await connection.query(\`
            SELECT i.*, 
                   IFNULL(m.mrp, 0) as mrp, 
                   IFNULL(m.fnsku, '') as fnsku, 
                   IFNULL(m.packing_dimension_length, 0) as packing_dimension_length,
                   IFNULL(m.packing_dimension_width, 0) as packing_dimension_width,
                   IFNULL(m.packing_dimension_height, 0) as packing_dimension_height,
                   IFNULL(m.packing_dimension_unit, 'cm') as packing_dimension_unit,
                   IFNULL(m.shipment_packaging, '[]') as shipment_packaging,
                   m.is_active
            FROM shipment_calculation_items i
            LEFT JOIN item_master m ON i.sku = m.sku
            WHERE i.plan_id = ?
        \`, [planId]);`;

const replace = `        const [items] = await connection.query(\`
            SELECT i.*, 
                   IFNULL(m.mrp, 0) as mrp, 
                   IFNULL(m.fnsku, '') as fnsku, 
                   IFNULL(m.packing_dimension_length, 0) as packing_dimension_length,
                   IFNULL(m.packing_dimension_width, 0) as packing_dimension_width,
                   IFNULL(m.packing_dimension_height, 0) as packing_dimension_height,
                   IFNULL(m.packing_dimension_unit, 'cm') as packing_dimension_unit,
                   IFNULL(m.shipment_packaging, '[]') as shipment_packaging,
                   IFNULL(sa.available_qty, 0) as group_available_qty,
                   m.is_active
            FROM shipment_calculation_items i
            LEFT JOIN item_master m ON i.sku = m.sku
            LEFT JOIN stock_availability sa ON sa.group_name = i.group_name
            WHERE i.plan_id = ?
        \`, [planId]);`;

code = code.replace(search, replace);
fs.writeFileSync('server/controller/calculation/calculation.js', code);
console.log('Replaced calculation.js');
