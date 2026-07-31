const db = require('./server/config/db');

async function testCols() {
    const connection = await db.getConnection();
    try {
        const [rows] = await connection.query("SELECT * FROM stock_availability LIMIT 5");
        console.log(rows);
    } catch (e) {
        console.error(e);
    } finally {
        connection.release();
        process.exit(0);
    }
}

testCols();
