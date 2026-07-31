const db = require('./server/config/db');

async function testCalcData() {
    const connection = await db.getConnection();
    try {
        const [items] = await connection.query("SELECT sku, sale_wh, available_qty FROM shipment_calculation_items WHERE plan_id = 82");
        const missing = items.filter(row => !row.available_qty && !row.sale_wh);
        console.log(`Total items: ${items.length}, Missing: ${missing.length}`);
        
        const blue = items.find(r => r.sku === 'Apron_Blue');
        console.log("Apron_Blue in DB:", blue);

    } catch (e) {
        console.error(e);
    } finally {
        connection.release();
        process.exit(0);
    }
}

testCalcData();
