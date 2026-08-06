const db = require('../../config/db');
const xlsx = require('xlsx');
// File ke top par jahan require statements hain wahan ye add karein
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { logActivity } = require('../../utils/logger');

// =======================================================
// 1. Check if Manifest Template Exists
// =======================================================
const checkTemplateStatus = async (req, res) => {
    let connection;
    try {
        const { marketplace_id } = req.query;
        if (!marketplace_id) {
            return res.json({ exists: false });
        }

        connection = await db.getConnection();
        const [rows] = await connection.query(
            `SELECT id FROM uploaded_reports WHERE report_type = 'Manifest_Template' AND marketplace_id = ? LIMIT 1`,
            [marketplace_id]
        );

        if (rows.length > 0) {
            return res.json({ exists: true });
        } else {
            return res.json({ exists: false });
        }
    } catch (error) {
        console.error("Check template error:", error);
        return res.status(500).json({ message: "Server error checking template status" });
    } finally {
        if (connection) connection.release();
    }
};

// =======================================================
// 2. Upload Manifest Template
// =======================================================
const uploadTemplate = async (req, res) => {
    let connection;
    try {
        const file = req.file;
        const { marketplace_id } = req.body;

        if (!file) return res.status(400).json({ message: "No file uploaded" });
        if (!marketplace_id) return res.status(400).json({ message: "Marketplace is required" });

        // File size calculate karna (e.g., "15.50 KB" ya "1.20 MB")
        let fileSize = (file.size / 1024).toFixed(2) + ' KB';
        if (file.size > 1024 * 1024) {
            fileSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
        }

        connection = await db.getConnection();

        // Pehle check karo ki kya is marketplace ka koi purana template hai
        const [oldRows] = await connection.query(
            `SELECT id, file_name FROM uploaded_reports WHERE report_type = 'Manifest_Template' AND marketplace_id = ?`,
            [marketplace_id]
        );

        if (oldRows.length > 0) {
            for (const old of oldRows) {
                // Server se purani file delete karo
                try {
                    const oldPath = path.join(process.cwd(), '../client/public/upload', old.file_name);
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }
                } catch (e) {
                    console.error("Failed to delete old template file", e);
                }
                
                // DB se purani entry delete karo
                await connection.query(`DELETE FROM uploaded_reports WHERE id = ?`, [old.id]);
            }
        }

        // Ab nayi file insert karo
        await connection.query(
            `INSERT INTO uploaded_reports (file_name, report_type, file_size, status, marketplace_id) 
             VALUES (?, 'Manifest_Template', ?, 'Success', ?)`,
            [file.filename, fileSize, marketplace_id]
        );

        await logActivity(req.user?.id, 'UPLOAD', 'Manifest', `Uploaded Manifest Template: ${file.filename}`);

        return res.json({ message: "Template uploaded successfully" });
    } catch (error) {
        console.error("Upload template error:", error);
        return res.status(500).json({ message: "Server error during upload" });
    } finally {
        if (connection) connection.release();
    }
};

// =======================================================
// 3. Download Manifest Using Custom Template (Preserving Design & Format using ExcelJS)
// =======================================================
const downloadManifest = async (req, res) => {
    let connection;
    try {
        const { manifestData, marketplace_id } = req.body;
        if (!manifestData || manifestData.length === 0) {
            return res.status(400).json({ message: "No data to export" });
        }
        if (!marketplace_id) {
            return res.status(400).json({ message: "Marketplace is required for export" });
        }

        connection = await db.getConnection();
        const [rows] = await connection.query(
            `SELECT file_name FROM uploaded_reports WHERE report_type = 'Manifest_Template' AND marketplace_id = ? ORDER BY id DESC LIMIT 1`,
            [marketplace_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Template not found. Please upload a template first." });
        }

        const templateFilename = rows[0].file_name;
        const templatePath = path.join(process.cwd(), '../client/public/upload', templateFilename);

        if (!fs.existsSync(templatePath)) {
            return res.status(404).json({ message: `File missing on server. Path: ${templatePath}` });
        }

        // 1. ExcelJS se Workbook load karein (Ye formatting preserve karega)
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(templatePath);

        const targetSheetName = "Create workflow – template";
        const ws = workbook.getWorksheet(targetSheetName);

        if (!ws) {
            return res.status(400).json({ message: `Sheet '${targetSheetName}' not found in the uploaded template.` });
        }

        let headerRowIndex = -1;
        let headerMap = {};

        // 2. Header row find karna aur columns map karna
        ws.eachRow((row, rowNumber) => {
            if (headerRowIndex !== -1) return; // Agar mil gaya to skip karo
            row.eachCell((cell, colNumber) => {
                if (cell.value && String(cell.value).trim().toLowerCase() === 'merchant sku') {
                    headerRowIndex = rowNumber;
                }
            });
            // Jab header row mil jaye, tab map save karo
            if (headerRowIndex !== -1) {
                row.eachCell((cell, colNumber) => {
                    if (cell.value) {
                        headerMap[String(cell.value).trim().toLowerCase()] = colNumber;
                    }
                });
            }
        });

        if (headerRowIndex === -1) {
            return res.status(400).json({ message: `Invalid template: 'Merchant SKU' column not found in '${targetSheetName}' sheet.` });
        }

        // 3. Header ke theek niche wale row se data append karna start karein
        // 3. Header ke theek niche wale row se data append karna start karein
        let currentRowToInsert = headerRowIndex + 1;

        // 🔥 Helper function: String ko number me convert karne ke liye (taki text error na aaye)
        const getNumericValue = (val) => {
            if (val === null || val === undefined || val === "") return "";
            const num = Number(val);
            return isNaN(num) ? val : num; // Agar number me convert ho sakta hai to number do, warna text
        };

        manifestData.forEach(item => {
            const row = ws.getRow(currentRowToInsert);

            // Map data to respective columns
            if (headerMap['merchant sku']) row.getCell(headerMap['merchant sku']).value = item.sku || "";

            // 🔥 Yahan humne Quantity ko Number me convert kiya hai
            if (headerMap['quantity']) row.getCell(headerMap['quantity']).value = getNumericValue(item.quantity);

            if (headerMap['fc']) row.getCell(headerMap['fc']).value = item.fc || "";
            if (headerMap['prep owner']) row.getCell(headerMap['prep owner']).value = item.prep_owner || "";
            if (headerMap['labeling owner']) row.getCell(headerMap['labeling owner']).value = item.labeling_owner || "";
            if (headerMap['prep category']) row.getCell(headerMap['prep category']).value = item.prep_category || "";

            // 🔥 HSN/SAC Code ko bhi pure number me convert kiya taki green warning hat jaye
            if (headerMap['hsn/sac code']) row.getCell(headerMap['hsn/sac code']).value = getNumericValue(item.hsn_sac_code);

            // 🔥 GST aur Declared Value ko bhi Number banaya hai
            if (headerMap['gst rate']) row.getCell(headerMap['gst rate']).value = getNumericValue(item.gst_rate);
            if (headerMap['declared value(per unit)']) row.getCell(headerMap['declared value(per unit)']).value = getNumericValue(item.declared_value_per_unit);

            row.commit(); // Changes save karein is row ke liye
            currentRowToInsert++;
        });

        // 4. Nayi file ko buffer me likhein aur send karein
        const buffer = await workbook.xlsx.writeBuffer();

        // Mark the active calculation plan as Completed
        await connection.query(
            `UPDATE shipment_calculations_master SET status = 'Completed' WHERE marketplace_id = ? AND status = 'Draft'`,
            [marketplace_id]
        );

        // Mark associated active files as manifested so they hide from Recent Uploads
        await connection.query(
            `UPDATE uploaded_reports SET is_manifested = 1 WHERE marketplace_id = ? AND is_manifested = 0 AND report_type NOT IN ('Calculation', 'Manifest_Template')`,
            [marketplace_id]
        );

        await logActivity(req.user?.id, 'DOWNLOAD', 'Manifest', `Generated and downloaded Manifest for Marketplace ID: ${marketplace_id}`);

        res.setHeader('Content-Disposition', 'attachment; filename="Manifest_Export.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error) {
        console.error("Download manifest error:", error);
        res.status(500).json({ message: "Server error during download" });
    } finally {
        if (connection) connection.release();
    }
};


module.exports = {
    checkTemplateStatus,
    uploadTemplate,
    downloadManifest
};