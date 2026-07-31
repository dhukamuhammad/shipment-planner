const db = require('./server/config/db');

async function checkData() {
    const connection = await db.getConnection();
    try {
        const [rows] = await connection.query("SELECT id, group_name, sku, available_qty, stock_alloc, final_wh FROM shipment_calculation_items WHERE plan_id = 82 LIMIT 20");
        console.log(rows);
    } catch (e) {
        console.error(e);
    } finally {
        connection.release();
        process.exit(0);
    }
}

checkData();
