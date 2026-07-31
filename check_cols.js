const db = require('./server/config/db');

async function testCols() {
    const connection = await db.getConnection();
    try {
        const [cols] = await connection.query("SHOW COLUMNS FROM shipment_calculation_items");
        console.log(cols.map(c => c.Field));

    } catch (e) {
        console.error(e);
    } finally {
        connection.release();
        process.exit(0);
    }
}

testCols();
