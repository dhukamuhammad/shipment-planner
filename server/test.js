
const mysql = require('mysql2/promise');
require('dotenv').config();
async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ship_b2b'
    });
    try {
        const [rows] = await conn.query('SELECT id, report_type, status, marketplace_id, uploaded_at FROM uploaded_reports WHERE report_type = \'Stock Availability\' ORDER BY uploaded_at DESC LIMIT 5');
        console.log(rows);
    } catch(err) {
        console.log(err.message);
    }
    conn.end();
}
run();

