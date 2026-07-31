const fs = require('fs');
const filepath = 'server/controller/calculation/calculation.js';
let content = fs.readFileSync(filepath, 'utf8');

const searchInsert = `            INSERT INTO shipment_calculation_items (
                plan_id, report_id, group_name, sku, title, category, 
                hsn, gst, cost, weight, mrp, fnsku,
                ref_sku, ref_title, ixd_fulfilment_id, warehouse_fulfilment_id, shipment_packaging,
                packing_dimension_length, packing_dimension_width, packing_dimension_height, packing_dimension_unit
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const replaceInsert = `            INSERT INTO shipment_calculation_items (
                plan_id, report_id, group_name, sku, title, category, 
                hsn, gst, cost, weight, mrp, fnsku,
                ref_sku, ref_title, ixd_fulfilment_id, warehouse_fulfilment_id, shipment_packaging,
                packing_dimension_length, packing_dimension_width, packing_dimension_height, packing_dimension_unit
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

if (content.includes(searchInsert)) {
    content = content.replace(searchInsert, replaceInsert);
}

// We also need to update the params passed to `connection.query(insertQuery, [...])` for `addManualCalculationRow`.
const searchParams = `        const [result] = await connection.query(insertQuery, [
            data.planId,
            reportId,
            data.groupName,
            data.sku,
            data.title || null,
            data.category || null,
            
            data.hsn || null,
            data.gst || null,
            data.cost || 0,
            data.weight || 0,
            data.mrp || 0,
            data.fnsku || null,

            data.sku,
            data.title || null,
            fcId,
            shipmentPackagingJSON,

            data.length || 0,
            data.width || 0,
            data.height || 0,
            data.dimensionUnit || 'cm'
        ]);`;

const replaceParams = `        const [result] = await connection.query(insertQuery, [
            data.planId,
            reportId,
            data.groupName,
            data.sku,
            data.title || null,
            data.category || null,
            
            data.hsn || null,
            data.gst || null,
            data.cost || 0,
            data.weight || 0,
            data.mrp || 0,
            data.fnsku || null,

            data.sku,
            data.title || null,
            fcId, // ixd_fulfilment_id
            null, // warehouse_fulfilment_id
            shipmentPackagingJSON,

            data.length || 0,
            data.width || 0,
            data.height || 0,
            data.dimensionUnit || 'cm'
        ]);`;

if (content.includes(searchParams)) {
    content = content.replace(searchParams, replaceParams);
}

fs.writeFileSync(filepath, content);
console.log('Fixed addManualCalculationRow insert logic');
