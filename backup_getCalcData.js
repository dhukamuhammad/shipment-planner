const getCalculationData = async (req, res) => {
    let connection;
    try {
        const { marketplace_id, planId, date } = req.query;

        // Removed strict restriction to allow fetching the latest plan by default
        // if (!planId && (!marketplace_id || !date)) {
        //     return successResponse(res, "No data selected", { master: null, items: [] }, 200);
        // }

        connection = await db.getConnection();

        let masterQuery = `SELECT * FROM shipment_calculations_master WHERE 1=1`;
        let masterParams = [];

        if (planId) {
            masterQuery += ` AND id = ?`;
            masterParams.push(planId);
        } else if (marketplace_id && date) {
            masterQuery += ` AND marketplace_id = ? AND DATE(created_at) = ? AND is_deleted = 0`;
            masterParams.push(marketplace_id, date);
        } else if (marketplace_id) {
            masterQuery += ` AND marketplace_id = ? AND status = 'Draft' AND is_deleted = 0`;
            masterParams.push(marketplace_id);
        } else {
            masterQuery += ` AND status = 'Draft' AND is_deleted = 0`;
        }

        masterQuery += ` ORDER BY created_at DESC LIMIT 1`;

        const [masterRows] = await connection.query(masterQuery, masterParams);

        if (masterRows.length === 0) {
            // Agar koi Draft plan nahi mila, but marketplace provide kiya gaya hai (Upload page se aaya hai)
            if (!planId && (!date || date === "") && marketplace_id) {
                // Latest Completed plan check karo
                const [completedRows] = await connection.query(
                    `SELECT * FROM shipment_calculations_master WHERE marketplace_id = ? AND status = 'Completed' ORDER BY created_at DESC LIMIT 1`,
                    [marketplace_id]
                );

                if (completedRows.length > 0) {
                    const lastPlan = completedRows[0];
                    // Naya Draft plan create karo pichle data ke basis par
                    const [newMasterRes] = await connection.query(
                        `INSERT INTO shipment_calculations_master (report_id, status, marketplace_id, afs_days, shipment_plan_days, bunch_qty, to_ship_qty) 
                         VALUES (?, 'Draft', ?, ?, ?, ?, ?)`,
                        [lastPlan.report_id, lastPlan.marketplace_id, lastPlan.afs_days, lastPlan.shipment_plan_days, lastPlan.bunch_qty, lastPlan.to_ship_qty]
                    );
                    const newPlanId = newMasterRes.insertId;

                    // Purane plan ke saare items clone karke naye plan me daal do
                    await connection.query(
                        `INSERT INTO shipment_calculation_items (
                            plan_id, report_id, marketplace_id, group_name, sku, title, category, 
                            int_wh, dec_wh, non_apron_qty, 
                            apr_sky_blue, apr_dark_blue, apr_brown, apr_green, apr_tan, apr_black, apr_red, apr_grey, 
                            weight, total_weight, hsn, gst, cost, mrp, fnsku,
                            ref_sku, ref_title, tra_qty, quantity, available_qty, fulfilment_id, 
                            sale_total, sale_wh, ship_wh, sum_val, final_wh, is_active, shipment_packaging
                        )
                         SELECT 
                            ?, report_id, marketplace_id, group_name, sku, title, category, 
                            int_wh, dec_wh, non_apron_qty, 
                            apr_sky_blue, apr_dark_blue, apr_brown, apr_green, apr_tan, apr_black, apr_red, apr_grey, 
                            weight, total_weight, hsn, gst, cost, mrp, fnsku,
                            ref_sku, ref_title, tra_qty, quantity, available_qty, fulfilment_id, 
                            sale_total, sale_wh, ship_wh, sum_val, final_wh, is_active, shipment_packaging
                         FROM shipment_calculation_items WHERE plan_id = ?`,
                        [newPlanId, lastPlan.id]
                    );

                    // Naya plan fetch karke list me daal do
                    const [newMasterRows] = await connection.query(`SELECT * FROM shipment_calculations_master WHERE id = ?`, [newPlanId]);
                    masterRows.push(newMasterRows[0]);
                }
            }
        }

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

        // --- BYPASS DYNAMIC CALCULATION FOR COMPLETED PLANS ---
        // Agar plan completed hai to purana freeze hua data bhej do
        if (masterData.status === 'Completed') {
            connection.release();
            return successResponse(res, "Data fetched successfully", {
                master: masterData,
                items: itemRows
            }, 200);
        }

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

        // Get latest DIH report ID for linking
        const [latestDihReport] = await connection.query(`
            SELECT id FROM uploaded_reports WHERE report_type = 'DIH' AND status = 'Success' AND marketplace_id = ? ORDER BY uploaded_at DESC LIMIT 1
        `, [masterData.marketplace_id]);
        const latestDihId = latestDihReport.length > 0 ? latestDihReport[0].id : null;

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

        // --- FETCH STOCK AVAILABILITY ---
        const [latestStockReport] = await connection.query(`
            SELECT id FROM uploaded_reports WHERE report_type = 'Stock' AND status = 'Success' AND marketplace_id = ? ORDER BY uploaded_at DESC LIMIT 1
        `, [masterData.marketplace_id]);
        
        const latestStockId = latestStockReport.length > 0 ? latestStockReport[0].id : null;
        let stockAvailableMap = {};
        if (latestStockId) {
            const [stockRows] = await connection.query(
                `SELECT group_name, SUM(available_qty) as total_available FROM stock_availability WHERE upload_id = ? GROUP BY group_name`,
                [latestStockId]
            );
            stockRows.forEach((r) => {
                if(r.group_name) {
                    stockAvailableMap[r.group_name.trim().toLowerCase()] = r.total_available;
                }
            });
        }

        // --- FETCH DYNAMIC EVENT MULTIPLIER ---
        let EVENT_MULTIPLIER = 1.0;
        const [eventRows] = await connection.query(`
            SELECT MAX(multiplier) as max_multiplier 
            FROM events_calendar 
            WHERE start_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY) 
            AND end_date >= CURDATE()
        `, [shipmentPlanDays]);

        if (eventRows.length > 0 && eventRows[0].max_multiplier) {
            EVENT_MULTIPLIER = parseFloat(eventRows[0].max_multiplier);
        }

        // Har item ke tra_qty, quantity, sale_total, sale_wh, sale_wh_avg, ship_wh ko calculate karke overwrite kar rahe hain

        // Configuration for Advanced Logic (1 to 9)
        // 8. Event / Festival Multiplier (Now dynamic from DB)
        // const EVENT_MULTIPLIER = 1.0; 
        const LEAD_TIME_DAYS = 7;     // 9. Dynamic Coverage (Supplier lead time)
        const OUT_OF_STOCK_DAYS = 0;  // 1. Stockout Correction (Mock value for out-of-stock days)
        const LISTING_AGE_DAYS = 100; // 2. Listing Age Filter (Mock value, >30 means old product)

        const bunchQty = Number(masterData.bunch_qty) || 0;

        // First Pass: Calculate basic values and group demands
        let groupDemandMap = {};
        
        let preliminaryItems = itemRows.map((item) => {
            const traQty = Number(transitQtyMap[item.sku]) || 0;
            const quantity = Number(dihQtyMap[item.sku]) || 0;
            const saleWh = Number(afsCurrentQtyMap[item.sku]) || 0;
            const saleWhAvg = Number(afsAvgQtyMap[item.sku]) || 0; // Historical 4-month total/avg

            // 6. Pipeline Inventory: Available = Transit (Pipeline) + Current Warehouse Stock
            const availableQty = traQty + quantity;

            let shipWh = 0;

            if (afsDays > 0) {
                shipWh = Math.ceil(((saleWh / afsDays) * shipmentPlanDays) - availableQty);
            }

            // Logic to calculate Int - WH from Frontend replicated here
            let intWh = item.int_wh; // Keep original if shipWh is negative or invalid
            let decWh = "";
            let calculatedFinalWh = "";
            if (!isNaN(shipWh) && shipWh >= 0) {
                if (shipWh === 0) {
                    intWh = 1;
                    decWh = 0;
                } else if (bunchQty > 0) {
                    intWh = Math.floor(shipWh / bunchQty);
                    decWh = (shipWh / bunchQty) - intWh;
                }
                
                if (shipWh > 0 && decWh !== "") {
                    calculatedFinalWh = (intWh * bunchQty) + (decWh > 0 ? bunchQty : 0);
                }
            }

            const displayFinalWh = item.is_manual_final_wh ? item.final_wh : calculatedFinalWh;

            // --- SUGGEST FINAL-WH CALCULATION ---
            let suggestedShipWh = 0;
            if (afsDays > 0) {
                suggestedShipWh = Math.ceil(((saleWhAvg / afsDays) * shipmentPlanDays) - availableQty);
            }

            let sugIntWh = "";
            let sugDecWh = "";
            let suggestFinalWh = "";

            if (!isNaN(suggestedShipWh) && suggestedShipWh >= 0) {
                if (suggestedShipWh === 0) {
                    sugIntWh = 1;
                    sugDecWh = 0;
                } else if (bunchQty > 0) {
                    sugIntWh = Math.floor(suggestedShipWh / bunchQty);
                    sugDecWh = (suggestedShipWh / bunchQty) - sugIntWh;
                }

                if (suggestedShipWh > 0 && sugDecWh !== "") {
                    suggestFinalWh = (sugIntWh * bunchQty) + (sugDecWh > 0 ? bunchQty : 0);
                }
            }

            const displaySuggestFinalWh = item.is_manual_suggest_final_wh ? item.suggest_final_wh : suggestFinalWh;
            const demand = Number(displaySuggestFinalWh) || 0;

            const grp = item.group_name ? item.group_name.trim().toLowerCase() : 'unknown';
            if (!groupDemandMap[grp]) groupDemandMap[grp] = 0;
            groupDemandMap[grp] += Math.max(0, demand); // Accumulate valid demand

            return {
                ...item,
                tra_qty: traQty,
                quantity: quantity,
                sale_total: businessQtyMap[item.sku] || 0,
                sale_wh: saleWh,
                sale_wh_avg: Math.round(saleWhAvg),
                available_qty: availableQty,
                ship_wh: Math.max(0, Math.round(shipWh)), // Final requirement rounded and not negative
                int_wh: intWh,
                dec_wh: decWh,
                final_wh: displayFinalWh,
                suggest_final_wh: displaySuggestFinalWh,
                _demand: Math.max(0, demand)
            };
        });

        // Second Pass: Proportional Stock Allocation
        const itemsWithTraQty = preliminaryItems.map((item) => {
            const grp = item.group_name ? item.group_name.trim().toLowerCase() : 'unknown';
            const totalAvailable = stockAvailableMap[grp] !== undefined ? Number(stockAvailableMap[grp]) : null;
            const totalDemand = groupDemandMap[grp] || 0;
            
            let stock_alloc_qty = null;
            let finalSuggested = item.suggest_final_wh;

            if (totalAvailable !== null) {
                if (totalDemand === 0) {
                    stock_alloc_qty = 0;
                    finalSuggested = 0;
                } else if (totalAvailable >= totalDemand) {
                    stock_alloc_qty = item._demand; // Enough stock to fulfill this SKU's demand entirely
                } else {
                    // Proportional allocation
                    stock_alloc_qty = Math.floor((item._demand / totalDemand) * totalAvailable);
                    finalSuggested = Math.min(item._demand, stock_alloc_qty);
                }
            }

            // Clean up temporary fields
            delete item._demand;

            return {
                ...item,
                stock_alloc: totalAvailable !== null ? `${totalAvailable} / ${stock_alloc_qty}` : '',
                stock_alloc_ratio: totalAvailable !== null && item._demand > 0 ? (stock_alloc_qty / item._demand) : null,
                suggest_final_wh: item.is_manual_suggest_final_wh ? item.suggest_final_wh : finalSuggested
            };
        });

        // SAVE REPORT IDs IN MASTER DATA FOR SMART DELETE
        let latestAfsIdToSave = null;
        if (latestAfsReport && latestAfsReport.length > 0) latestAfsIdToSave = latestAfsReport[0].id;
        
        await connection.query(
            `UPDATE shipment_calculations_master SET afs_report_id = ?, dih_report_id = ?, transit_report_id = ? WHERE id = ?`,
            [latestAfsIdToSave, latestDihId, latestTransitId, masterData.id]
        );

        // --- BACKGROUND AUTO-SAVE ---
        // Dynamically calculated values ko DB me save kar dete hain
        // Taaki 'Completed' hone par yahi frozen data return ho sake
        if (masterData.status !== 'Completed') {
            setImmediate(async () => {
                let bgConnection;
                try {
                    bgConnection = await db.getConnection();
                    for (const item of itemsWithTraQty) {
                        await bgConnection.query(
                            `UPDATE shipment_calculation_items SET tra_qty=?, quantity=?, available_qty=?, sale_wh=?, sale_wh_avg=?, ship_wh=?, int_wh=?, dec_wh=?, final_wh=?, suggest_final_wh=?, stock_alloc=? WHERE id=?`,
                            [item.tra_qty, item.quantity, item.available_qty, item.sale_wh, item.sale_wh_avg, item.ship_wh, item.int_wh, item.dec_wh || 0, item.final_wh || 0, item.suggest_final_wh || 0, item.stock_alloc || null, item.id]
                        );
                    }
                } catch (e) {
                    console.error("Auto-save items background error:", e);
                } finally {
                    if (bgConnection) bgConnection.release();
                }
            });
        }

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

// =======================================================
// 4. INLINE EDIT (AUTO-SAVE) FOR MASTER DATA
// =======================================================
