const db = require('./server/config/db');
async function run() {
    const conn = await db.getConnection();
    try {
        const [rows] = await conn.query('SHOW TABLES LIKE "ixd_warehouses"');
        console.log(rows);
    } catch(e) { console.error(e); }
    conn.release();
    process.exit();
}
run();
