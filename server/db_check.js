const db = require('./config/db');
async function check() {
    try {
        const [rows82] = await db.query(`SELECT COUNT(*) as count FROM shipment_calculation_items WHERE plan_id = 82 AND sku = 'hello'`);
        const [rows86] = await db.query(`SELECT COUNT(*) as count FROM shipment_calculation_items WHERE plan_id = 86 AND sku = 'hello'`);
        console.log('Hello count in plan 82:', rows82[0].count);
        console.log('Hello count in plan 86:', rows86[0].count);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
check();
