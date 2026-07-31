const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
    const db = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [rows] = await db.query("SELECT * FROM afs_data ORDER BY id DESC LIMIT 5");
        console.log("afs_data latest 5 rows:");
        console.log(JSON.stringify(rows, null, 2));
    } catch(e) {
        console.error(e);
    }
    
    await db.end();
}
check();
