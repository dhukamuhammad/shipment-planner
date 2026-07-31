const db = require('./server/config/db');

async function testCols() {
    const connection = await db.getConnection();
    try {
        const [rows] = await connection.query("SELECT id, sku, ixd_fulfilment_id, warehouse_fulfilment_id FROM shipment_calculation_items ORDER BY id DESC LIMIT 5");
        console.log(rows);
    } catch (e) {
        console.error(e);
    } finally {
        connection.release();
        process.exit(0);
    }
}

testCols();
