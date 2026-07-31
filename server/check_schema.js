const db = require("./config/db");

async function checkSchema() {
    try {
        const connection = await db.getConnection();
        const [rows] = await connection.query("DESCRIBE shipment_calculation_items");
        console.log(JSON.stringify(rows, null, 2));
        connection.release();
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

checkSchema();
