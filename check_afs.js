const db = require('./server/config/db');

async function testAFS() {
    const connection = await db.getConnection();
    try {
        const [latestAfsReport] = await connection.query(`
            SELECT report_id as id, MAX(shipment_date) as max_date 
            FROM afs_data 
            WHERE shipment_date IS NOT NULL AND shipment_date != ''
            GROUP BY report_id 
            ORDER BY max_date DESC 
            LIMIT 1
        `);
        console.log("Latest AFS Report:", latestAfsReport);

        if (latestAfsReport.length > 0) {
            const latestAfsId = latestAfsReport[0].id;
            const [afsCurrentRows] = await connection.query(
                `SELECT merchant_sku, SUM(shipped_quantity) as total_shipped_qty FROM afs_data WHERE report_id = ? GROUP BY merchant_sku`,
                [latestAfsId]
            );
            console.log(`Report ${latestAfsId} has ${afsCurrentRows.length} SKUs.`);
            const blue = afsCurrentRows.find(r => r.merchant_sku === 'Apron_Blue');
            console.log("Apron_Blue in latest report:", blue);
        }

    } catch (e) {
        console.error(e);
    } finally {
        connection.release();
        process.exit(0);
    }
}

testAFS();
