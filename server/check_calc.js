const db = require('./config/db');
async function test() {
    try {
        const c = await db.getConnection();
        const [reports] = await c.query("SELECT * FROM uploaded_reports WHERE report_type = 'Calculation' ORDER BY uploaded_at DESC LIMIT 1");
        console.log("LAST CALCULATION FILE:", reports);
        process.exit(0);
    } catch (e) {
        console.error(e);
    }
}
test();
