const getCalculationData = async (req, res) => {
    let connection;
    try {
        const { marketplace_id } = req.query;
        connection = await db.getConnection();

        // Sabse recent master plan (top cards data) nikal rahe hain, with optional marketplace filter
        let masterQuery = `SELECT * FROM shipment_calculations_master`;
        let masterParams = [];
        
        if (marketplace_id) {
            masterQuery += ` WHERE marketplace_id = ?`;
            masterParams.push(marketplace_id);
        }
        
        masterQuery += ` ORDER BY created_at DESC LIMIT 1`;

        const [masterRows] = await connection.query(masterQuery, masterParams);

        if (masterRows.length === 0) {
            connection.release();
            return successResponse(res, "No data found", { master: null, items: [] }, 200);
        }

        const masterData = masterRows[0];

        let calculatedAfsDays = masterData.afs_days; // Default fallback

        // Master ID ke basis par saari SKUs (rows) nikal rahe hain
        const [itemRows] = await connection.query(
            `SELECT * FROM shipment_calculation_items WHERE plan_id = ?`,
            [masterData.id]
        );

        // --- SMART DATE MATCHING FOR TRANSIT SHIPMENT ---
        const [latestOtherReports] = await connection.query(`
            SELECT MAX(uploaded_at) as latest_other_time
            FROM uploaded_reports
            WHERE report_type IN ('AFS', 'Business', 'DIH') AND status = 'Success'
        `);
        
        const [latestTransitReport] = await connection.query(`
            SELECT id, uploaded_at FROM uploaded_reports WHERE report_type = 'Transit Shipment' AND status = 'Success' ORDER BY uploaded_at DESC LIMIT 1
        `);

        let latestTransitId = null;
        if (latestTransitReport.length > 0) {
            if (latestOtherReports.length > 0 && latestOtherReports[0].latest_other_time) {
                const otherTime = new Date(latestOtherReports[0].latest_other_time).getTime();
                const transitTime = new Date(latestTransitReport[0].uploaded_at).getTime();
                const hoursDiff = Math.abs(otherTime - transitTime) / (1000 * 60 * 60);
                // 12 hours window
                if (hoursDiff <= 12) {
                    latestTransitId = latestTransitReport[0].id;
                }
            } else {
                 latestTransitId = latestTransitReport[0].id; // Fallback if no other reports exist
            }
        }

        let transitRows = [];
        if (latestTransitId) {
            [transitRows] = await connection.query(
                `SELECT merchant_sku, SUM(quantity) as total_qty FROM transit_shipment_data WHERE report_id = ? GROUP BY merchant_sku`,
                [latestTransitId]
            );
        }

        const transitQtyMap = {};
        transitRows.forEach((r) => {
            transitQtyMap[r.merchant_sku] = r.total_qty;
        });

        // DIH report se SKU-wise total Ending Warehouse Balance nikal rahe hain (Quantity column ke liye)
        const [dihRows] = await connection.query(
            `SELECT msku, SUM(ending_warehouse_balance) as total_ending_balance FROM dih_data GROUP BY msku`
        );
        const dihQtyMap = {};
        dihRows.forEach((r) => {
            dihQtyMap[r.msku] = r.total_ending_balance;
        });

        // Business report se SKU-wise total Units Ordered nikal rahe hain (Sale-Total ke liye)
        const [businessRows] = await connection.query(
            `SELECT sku, SUM(units_ordered) as total_units_ordered FROM business_data GROUP BY sku`
        );
        const businessQtyMap = {};
        businessRows.forEach((r) => {
            businessQtyMap[r.sku] = r.total_units_ordered;
        });

        // --- Naya AFS Logic: Current Month aur 4-Month Avg ke liye ---
        
        // 1. Sabse pehle latest AFS report nikalte hain (Current Month 'Sale-WH' ke liye)
        const [latestAfsReport] = await connection.query(`
            SELECT report_id as id, MAX(shipment_date) as max_date 
            FROM afs_data 
            WHERE shipment_date IS NOT NULL AND shipment_date != ''
            GROUP BY report_id 
            ORDER BY max_date DESC 
            LIMIT 1
        `);
        
        let afsCurrentQtyMap = {};
        if (latestAfsReport.length > 0) {
            const latestAfsId = latestAfsReport[0].id;

            // --- NEW: Calculate afs_days dynamically from only the LATEST afs_data report ---
            const [afsDates] = await connection.query(
                `SELECT DATEDIFF(MAX(DATE(shipment_date)), MIN(DATE(shipment_date))) + 1 as total_days 
                 FROM afs_data 
                 WHERE shipment_date IS NOT NULL AND shipment_date != '' AND report_id = ?`,
                [latestAfsId]
            );

            if (afsDates.length > 0 && afsDates[0].total_days) {
                calculatedAfsDays = afsDates[0].total_days;
            }

            // Sirf latest report ka data (Current Sale-WH)
            const [afsCurrentRows] = await connection.query(
                `SELECT merchant_sku, SUM(shipped_quantity) as total_shipped_qty FROM afs_data WHERE report_id = ? GROUP BY merchant_sku`,
                [latestAfsId]
            );
            afsCurrentRows.forEach((r) => {
                afsCurrentQtyMap[r.merchant_sku] = r.total_shipped_qty;
            });
        }

        // Override the database value so frontend receives the exact calculated days
        masterData.afs_days = calculatedAfsDays;

        // 2. 4-Month ka Total aur Count nikalte hain (Avg ke liye)
        const [afsAvgRows] = await connection.query(
            `SELECT merchant_sku, SUM(shipped_quantity) as total_qty, COUNT(DISTINCT report_id) as month_count 
             FROM afs_data 
             GROUP BY merchant_sku`
        );
        const afsAvgQtyMap = {};
        afsAvgRows.forEach((r) => {
            const count = r.month_count > 0 ? r.month_count : 1;
            afsAvgQtyMap[r.merchant_sku] = r.total_qty / count;
        });

        // Master ke afs_days aur shipment_plan_days nikal rahe hain (Ship-WH formula ke liye)
        const afsDays = Number(masterData.afs_days) || 0;
        const shipmentPlanDays = Number(masterData.shipment_plan_days) || 0;

        // Har item ke tra_qty, quantity, sale_total, sale_wh, sale_wh_avg, ship_wh ko calculate karke overwrite kar rahe hain
        const itemsWithTraQty = itemRows.map((item) => {
            const traQty = Number(transitQtyMap[item.sku]) || 0;
            const quantity = Number(dihQtyMap[item.sku]) || 0;
            const saleWh = Number(afsCurrentQtyMap[item.sku]) || 0;

            // Available Qty = Tra. Qty + Quantity
            const availableQty = traQty + quantity;

            // Formula: Ship-WH = (Sale-WH / AFS Days * Shipment Plan Days) - Available Qty
            // Note: User ke hisab se Ship-WH calculate karne mein hamesha current Sale-WH use hota hai, toh woh waisa hi rakhenge
            let shipWh = 0;
            if (afsDays > 0) {
                shipWh = ((saleWh / afsDays) * shipmentPlanDays) - availableQty;
            }

            return {
                ...item,
                tra_qty: traQty,
                quantity: quantity,
                sale_total: businessQtyMap[item.sku] || 0,
                sale_wh: saleWh,
                sale_wh_avg: Math.round(afsAvgQtyMap[item.sku] || 0),
                available_qty: availableQty,
                ship_wh: Math.round(shipWh)
            };
        });

        connection.release();

        return successResponse(res, "Data fetched successfully", {
            master: masterData,
            items: itemsWithTraQty
        }, 200);

    } catch (error) {
        console.error("Fetch Calculation Data Error:", error);
        if (connection) connection.release();
        return errorResponse(res, "Failed to fetch calculation data", 500);
    }
};
