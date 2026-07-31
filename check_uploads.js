const db = require('./server/config/db');

async function testUploads() {
    const connection = await db.getConnection();
    try {
        const [reports] = await connection.query(`SELECT id, report_type, status, uploaded_at FROM uploaded_reports ORDER BY id DESC LIMIT 10`);
        console.table(reports);

    } catch (e) {
        console.error(e);
    } finally {
        connection.release();
        process.exit(0);
    }
}

testUploads();
