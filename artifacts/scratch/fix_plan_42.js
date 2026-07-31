const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'server/.env' });

async function fix() {
    const db = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'shipment_planner'
    });
    
    await db.query("UPDATE shipment_calculations_master SET status = 'Draft' WHERE id = 42");
    console.log('Plan 42 set back to Draft.');
    
    db.end();
}
fix();
