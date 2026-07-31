const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    
    try {
        await conn.query('ALTER TABLE shipment_calculation_items ADD COLUMN warehouse_fulfilment_id LONGTEXT DEFAULT NULL AFTER ixd_fulfilment_id');
        console.log('Added warehouse_fulfilment_id column');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('warehouse_fulfilment_id column already exists');
        } else {
            console.error('Error adding column:', err.message);
        }
    }
    
    try {
        await conn.query(`ALTER TABLE ixd_warehouses ADD COLUMN type ENUM('IXD', 'Warehouse') NOT NULL DEFAULT 'IXD' AFTER name`);
        console.log('Added type column to ixd_warehouses');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('type column already exists');
        } else {
            console.error('Error adding type:', err.message);
        }
    }
    
    // We also need to change the UNIQUE KEY to include the `type` column so that the same name can exist for both IXD and Warehouse on the same marketplace if needed.
    try {
        await conn.query('ALTER TABLE ixd_warehouses DROP INDEX unique_marketplace_name');
        await conn.query('ALTER TABLE ixd_warehouses ADD UNIQUE KEY unique_marketplace_name_type (marketplace_id, name, type)');
        console.log('Updated unique key on ixd_warehouses');
    } catch (err) {
        console.error('Error updating unique key:', err.message);
    }
    
    process.exit(0);
}
run();
