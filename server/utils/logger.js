const db = require('../config/db');

const logActivity = async (user_id, action, module, description) => {
    try {
        if (!user_id) return; // Don't log if we can't identify the user

        const query = `
            INSERT INTO activity_logs (user_id, action, module, description)
            VALUES (?, ?, ?, ?)
        `;
        
        await db.query(query, [user_id, action, module, description]);
    } catch (error) {
        console.error("Failed to log activity:", error);
    }
};

module.exports = { logActivity };
