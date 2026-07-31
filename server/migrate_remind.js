require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'shipment',
    });

    console.log('Connected to DB...');

    // Check existing columns
    const [cols] = await connection.query(`SHOW COLUMNS FROM events_calendar`);
    const colNames = cols.map(c => c.Field);
    console.log('Existing columns:', colNames);

    if (!colNames.includes('remind_before_value')) {
        await connection.query(`ALTER TABLE events_calendar ADD COLUMN remind_before_value INT DEFAULT 3`);
        console.log('✅ Added remind_before_value column');
    } else {
        console.log('ℹ️  remind_before_value already exists');
    }

    if (!colNames.includes('remind_before_unit')) {
        await connection.query(`ALTER TABLE events_calendar ADD COLUMN remind_before_unit VARCHAR(10) DEFAULT 'days'`);
        console.log('✅ Added remind_before_unit column');
    } else {
        console.log('ℹ️  remind_before_unit already exists');
    }

    await connection.end();
    console.log('Migration complete!');
}

migrate().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
