const db = require('./server/config/db');

async function checkSKUs() {
    const connection = await db.getConnection();
    try {
        const [afs] = await connection.query("SELECT merchant_sku, shipped_quantity FROM afs_data LIMIT 10");
        console.log("AFS SKUs sample:", afs);
        
        const [items] = await connection.query("SELECT sku FROM shipment_calculation_items WHERE plan_id = 82 LIMIT 10");
        console.log("Calculation SKUs sample:", items.map(i => i.sku));

    } catch (e) {
        console.error(e);
    } finally {
        connection.release();
        process.exit(0);
    }
}

checkSKUs();
