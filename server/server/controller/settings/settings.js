const db = require("../../config/db");

// Get all settings
const getSettings = async (req, res) => {
    try {
        const connection = await db.getConnection();
        const [rows] = await connection.query(`SELECT setting_key, setting_value FROM app_settings`);
        connection.release();
        
        const settings = {};
        rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });

        return res.status(200).json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error("Get Settings Error:", error);
        return res.status(500).json({ success: false, message: "Server error getting settings" });
    }
};

// Update a setting
const updateSetting = async (req, res) => {
    try {
        const { setting_key, setting_value } = req.body;
        if (!setting_key) {
            return res.status(400).json({ success: false, message: "Setting key is required" });
        }

        const connection = await db.getConnection();
        await connection.query(
            `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) 
             ON DUPLICATE KEY UPDATE setting_value = ?`,
            [setting_key, String(setting_value), String(setting_value)]
        );
        connection.release();

        return res.status(200).json({
            success: true,
            message: "Setting updated successfully"
        });
    } catch (error) {
        console.error("Update Setting Error:", error);
        return res.status(500).json({ success: false, message: "Server error updating setting" });
    }
};

// Get IXD and Regular Warehouses
const getIxdWarehouses = async (req, res) => {
    try {
        const connection = await db.getConnection();
        const [marketplaces] = await connection.query(`SELECT id, name FROM marketplaces WHERE is_active = 1`);
        const [rows] = await connection.query(`
            SELECT iw.*, m.name as marketplace_name 
            FROM ixd_warehouses iw 
            JOIN marketplaces m ON iw.marketplace_id = m.id 
            ORDER BY iw.type, m.name, iw.id ASC
        `);
        connection.release();

        // Initialize grouped with ALL marketplaces for both types
        const grouped = { IXD: {}, Warehouse: {} };
        marketplaces.forEach(m => {
            grouped.IXD[m.name] = [];
            grouped.Warehouse[m.name] = [];
        });

        rows.forEach(row => {
            const type = row.type || 'IXD';
            if (grouped[type] && grouped[type][row.marketplace_name]) {
                grouped[type][row.marketplace_name].push(row);
            }
        });

        return res.status(200).json({ success: true, data: grouped, platforms: marketplaces.map(m => m.name) });
    } catch (error) {
        console.error("Get IXD Warehouses Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// Toggle IXD/Regular Warehouse
const toggleIxdWarehouse = async (req, res) => {
    try {
        const { id, is_active } = req.body;
        if (!id) return res.status(400).json({ success: false, message: "Warehouse ID is required" });

        const connection = await db.getConnection();
        
        // Fetch the type and marketplace_id of the target warehouse
        const [rows] = await connection.query(`SELECT type, marketplace_id FROM ixd_warehouses WHERE id = ?`, [id]);
        if (rows.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, message: "Warehouse not found" });
        }
        
        const { type, marketplace_id } = rows[0];

        // If it's IXD and we are activating it, deactivate all other IXDs for the same marketplace
        if (type === 'IXD' && is_active) {
            await connection.query(`UPDATE ixd_warehouses SET is_active = 0 WHERE type = 'IXD' AND marketplace_id = ?`, [marketplace_id]);
        }

        await connection.query(`UPDATE ixd_warehouses SET is_active = ? WHERE id = ?`, [is_active ? 1 : 0, id]);
        connection.release();

        return res.status(200).json({ success: true, message: "Warehouse updated successfully" });
    } catch (error) {
        console.error("Toggle IXD Warehouse Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// Add New IXD/Regular Warehouse
const addIxdWarehouse = async (req, res) => {
    try {
        const { name, type, platform } = req.body;
        
        if (!name || !type || !platform) {
            return res.status(400).json({ success: false, message: "Name, type, and platform are required" });
        }

        const connection = await db.getConnection();
        
        // Find the marketplace_id based on the platform name
        const [marketplaces] = await connection.query(`SELECT id FROM marketplaces WHERE name = ?`, [platform]);
        if (marketplaces.length === 0) {
            connection.release();
            return res.status(400).json({ success: false, message: "Invalid platform" });
        }
        
        const marketplace_id = marketplaces[0].id;

        // Insert into ixd_warehouses
        await connection.query(
            `INSERT INTO ixd_warehouses (name, type, marketplace_id, is_active) VALUES (?, ?, ?, 1)`, 
            [name, type, marketplace_id]
        );
        connection.release();

        return res.status(200).json({ success: true, message: `${type} added successfully` });
    } catch (error) {
        console.error("Add IXD Warehouse Error:", error);
        // Handle duplicate entry gracefully if there is a unique constraint
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: "This warehouse already exists for the platform." });
        }
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// Edit IXD/Regular Warehouse
const editIxdWarehouse = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, platform } = req.body;
        
        if (!id || !name || !platform) {
            return res.status(400).json({ success: false, message: "ID, new name, and platform are required" });
        }

        const connection = await db.getConnection();
        
        const [marketplaces] = await connection.query(`SELECT id FROM marketplaces WHERE name = ?`, [platform]);
        if (marketplaces.length === 0) {
            connection.release();
            return res.status(400).json({ success: false, message: "Invalid platform" });
        }
        
        const marketplace_id = marketplaces[0].id;

        await connection.query(`UPDATE ixd_warehouses SET name = ?, marketplace_id = ? WHERE id = ?`, [name, marketplace_id, id]);
        connection.release();

        return res.status(200).json({ success: true, message: "Warehouse updated successfully" });
    } catch (error) {
        console.error("Edit IXD Warehouse Error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: "This warehouse name already exists for this platform." });
        }
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// Delete IXD/Regular Warehouse
const deleteIxdWarehouse = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({ success: false, message: "ID is required" });
        }

        const connection = await db.getConnection();
        await connection.query(`DELETE FROM ixd_warehouses WHERE id = ?`, [id]);
        connection.release();

        return res.status(200).json({ success: true, message: "Warehouse deleted successfully" });
    } catch (error) {
        console.error("Delete IXD Warehouse Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

module.exports = {
    getSettings,
    updateSetting,
    getIxdWarehouses,
    toggleIxdWarehouse,
    addIxdWarehouse,
    editIxdWarehouse,
    deleteIxdWarehouse
};
