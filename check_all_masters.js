const db = require('./server/config/db');

async function checkDB() {
    const connection = await db.getConnection();
    try {
        const [masters] = await connection.query("SELECT * FROM shipment_calculations_master");
        console.table(masters);
    } catch (e) {
        console.error(e);
    } finally {
        connection.release();
        process.exit(0);
    }
}

checkDB();
