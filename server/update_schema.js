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
        await conn.query('ALTER TABLE shipment_calculation_items CHANGE fulfilment_id ixd_fulfilment_id LONGTEXT');
        console.log('Renamed fulfilment_id to ixd_fulfilment_id');
    } catch (err) {
        if (err.code === 'ER_BAD_FIELD_ERROR') {
            console.log('fulfilment_id already renamed or does not exist');
        } else {
            console.error('Error renaming:', err.message);
        }
    }
    
    try {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS ixd_warehouses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                marketplace_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_marketplace_name (marketplace_id, name)
            )
        `);
        console.log('Created ixd_warehouses table');
    } catch (err) {
        console.error('Error creating ixd_warehouses:', err.message);
    }
    
    process.exit(0);
}
run();
