// services/reportProcessor.js

const xlsx = require("xlsx");
const db = require("../config/db");
const fs = require('fs');

// Headers ko yahan bhi define karein
const afsHeaders = [
    "Amazon Order Id", "Merchant Order Id", "Shipment ID", "Shipment Item Id",
    "Amazon Order Item Id", "Merchant Order Item Id", "Purchase Date",
    "Payments Date", "Shipment Date", "Reporting Date", "Buyer Email",
    "Buyer Name", "Buyer Phone Number", "Merchant SKU", "Title",
    "Shipped Quantity", "Currency", "Item Price", "Item Tax",
    "Shipping Price", "Shipping Tax", "Gift Wrap Price", "Gift Wrap Tax",
    "Recipient Name", "Shipping Address 1", "Shipping Address 2",
    "Shipping Address 3", "Shipping City", "Shipping State",
    "Shipping Postal Code", "Shipping Country Code", "Shipping Phone Number",
    "Billing Address 1", "Billing Address 2", "Billing Address 3",
    "Billing City", "Billing State", "bill-postal-code", "bill-country",
    "Item Promo Discount", "Shipment Promo Discount", "Carrier",
    "Tracking Number", "Estimated Arrival Date", "FC", "Fulfillment Channel",
    "Sales Channel"
];


const processFile = async (filePath, reportId) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: File parse karein
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });

        if (rawData.length === 0) {
            throw new Error("File is empty");
        }

        // Step 2: Data ko bulk insert ke liye prepare karein
        const bulkValues = rawData.map((row) => {
            const rowValues = [reportId];
            afsHeaders.forEach((header) => {
                rowValues.push(row[header] !== undefined ? row[header] : null);
            });
            return rowValues;
        });

        const insertQuery = `INSERT INTO afs_data (report_id, amazon_order_id, merchant_order_id, shipment_id, shipment_item_id, amazon_order_item_id, merchant_order_item_id, purchase_date, payments_date, shipment_date, reporting_date, buyer_email, buyer_name, buyer_phone_number, merchant_sku, title, shipped_quantity, currency, item_price, item_tax, shipping_price, shipping_tax, gift_wrap_price, gift_wrap_tax, recipient_name, shipping_address_1, shipping_address_2, shipping_address_3, shipping_city, shipping_state, shipping_postal_code, shipping_country_code, shipping_phone_number, billing_address_1, billing_address_2, billing_address_3, billing_city, billing_state, bill_postal_code, bill_country, item_promo_discount, shipment_promo_discount, carrier, tracking_number, estimated_arrival_date, fc, fulfillment_channel, sales_channel) VALUES ?`;

        // Step 3: Parallel insertion
        const CHUNK_SIZE = 1000;
        const insertPromises = [];
        for (let i = 0; i < bulkValues.length; i += CHUNK_SIZE) {
            const chunk = bulkValues.slice(i, i + CHUNK_SIZE);
            insertPromises.push(connection.query(insertQuery, [chunk]));
        }
        await Promise.all(insertPromises);

        // Step 4: Status 'Success' update karein
        await connection.query(`UPDATE uploaded_reports SET status = 'Success' WHERE id = ?`, [reportId]);
        await connection.commit();
        console.log(`Report ID: ${reportId} processed successfully.`);

    } catch (error) {
        // Step 5: Error aane par status 'Failed' update karein
        await connection.rollback();
        await connection.query(`UPDATE uploaded_reports SET status = 'Failed' WHERE id = ?`, [reportId]);
        console.error(`Failed to process Report ID: ${reportId}. Error: ${error.message}`);
    } finally {
        if (connection) connection.release();
        // File process hone ke baad use delete kar dein
        fs.unlink(filePath, (err) => {
            if (err) console.error(`Failed to delete temp file: ${filePath}`, err);
        });
    }
};

// Wrapper function to run the process in the background
const processFileInBackground = (filePath, reportId) => {
    // setImmediate ensures this code runs in the next I/O cycle, freeing the current request
    setImmediate(() => {
        processFile(filePath, reportId).catch(err => {
            console.error("Unhandled error in background processor:", err);
        });
    });
};

module.exports = { processFileInBackground };
