const db = require("./config/db");

async function alterTable() {
    try {
        const connection = await db.getConnection();
        const [rows] = await connection.query("ALTER TABLE shipment_calculation_items CHANGE custom_attributes shipment_packaging JSON DEFAULT NULL");
        console.log("Success:", rows);
        connection.release();
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit();
}

alterTable();
