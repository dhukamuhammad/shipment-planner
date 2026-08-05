const mysql = require("mysql2/promise");
require("dotenv").config();
async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "ship_b2b"
    });
    try {
        await conn.query("UPDATE uploaded_reports SET report_type = ? WHERE id = ?", ["Stock", 404]);
        console.log("Fixed DB record 404");
    } catch(err) {
        console.log(err.message);
    }
    conn.end();
}
run();

