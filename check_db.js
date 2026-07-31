const db = require('./server/config/db');

async function checkDB() {
    const connection = await db.getConnection();
    try {
        const [masters] = await connection.query("SELECT id, marketplace_id, status FROM shipment_calculations_master ORDER BY created_at DESC LIMIT 5");
        console.log("Recent Masters:");
        console.table(masters);
        
        for (const master of masters) {
            const [items] = await connection.query("SELECT COUNT(*) as count FROM shipment_calculation_items WHERE plan_id = ?", [master.id]);
            console.log(`Master ID ${master.id} has ${items[0].count} items.`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        connection.release();
        process.exit(0);
    }
}

checkDB();
