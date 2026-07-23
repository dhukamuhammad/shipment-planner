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

module.exports = {
    getSettings,
    updateSetting
};
