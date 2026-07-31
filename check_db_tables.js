const db = require('./server/config/db');

async function checkDB() {
    const connection = await db.getConnection();
    try {
        const [afs] = await connection.query("SELECT COUNT(*) as c FROM afs_data");
        const [dih] = await connection.query("SELECT COUNT(*) as c FROM dih_data");
        const [transit] = await connection.query("SELECT COUNT(*) as c FROM transit_shipment_data");
        const [business] = await connection.query("SELECT COUNT(*) as c FROM business_data");
        const [stock] = await connection.query("SELECT COUNT(*) as c FROM stock_availability");
        
        console.log(`AFS: ${afs[0].c}`);
        console.log(`DIH: ${dih[0].c}`);
        console.log(`Transit: ${transit[0].c}`);
        console.log(`Business: ${business[0].c}`);
        console.log(`Stock: ${stock[0].c}`);

    } catch (e) {
        console.error(e);
    } finally {
        connection.release();
        process.exit(0);
    }
}

checkDB();
