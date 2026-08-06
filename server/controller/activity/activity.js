const db = require('../../config/db');

const getActivityLogs = async (req, res) => {
    try {
        const { userId } = req.query;
        let query = `
            SELECT a.id, a.action, a.module, a.description, a.created_at, u.name as user_name, u.email as user_email
            FROM activity_logs a
            LEFT JOIN users u ON a.user_id = u.id
        `;
        const queryParams = [];

        if (userId) {
            query += ` WHERE a.user_id = ? `;
            queryParams.push(userId);
        }

        query += ` ORDER BY a.created_at DESC `;
        
        const [logs] = await db.query(query, queryParams);

        res.status(200).json({ success: true, data: logs });
    } catch (error) {
        console.error("Get Activity Logs Error:", error);
        res.status(500).json({ success: false, message: 'Failed to fetch activity logs', error: error.message });
    }
};

module.exports = { getActivityLogs };
