const db = require('./server/config/db');

async function fixData() {
    const connection = await db.getConnection();
    try {
        console.log("Checking for empty master records...");
        
        // Find all master records
        const [masters] = await connection.query("SELECT id FROM shipment_calculations_master ORDER BY created_at DESC");
        
        for (const master of masters) {
            const [items] = await connection.query("SELECT COUNT(*) as count FROM shipment_calculation_items WHERE plan_id = ?", [master.id]);
            if (items[0].count === 0) {
                console.log(`Master ID ${master.id} has 0 items. Deleting it...`);
                await connection.query("DELETE FROM shipment_calculations_master WHERE id = ?", [master.id]);
                // optionally delete from uploaded_reports too, but master is enough for frontend to skip it
            } else {
                console.log(`Master ID ${master.id} has ${items[0].count} items. Keeping it.`);
                break; // Stop at the first master that has data, to be safe. We only want to delete recent empty ones.
            }
        }
        
        console.log("Cleanup complete!");
    } catch (e) {
        console.error("Error:", e);
    } finally {
        connection.release();
        process.exit(0);
    }
}

fixData();
