const db = require('../../config/db');
const bcrypt = require('bcrypt');
const { logActivity } = require('../../utils/logger');

const createUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ success: false, message: 'Please provide all required fields' });
        }

        const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const insertQuery = `
            INSERT INTO users (name, email, password, role)
            VALUES (?, ?, ?, ?)
        `;
        
        await db.query(insertQuery, [name, email, hashedPassword, role]);

        await logActivity(req.user?.id, 'CREATE', 'Users', `Created new user: ${email} (${role})`);

        res.status(201).json({ success: true, message: 'User created successfully' });
    } catch (error) {
        console.error("Create User Error:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};

const getUsers = async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT u.id, u.name, u.email, u.role, u.created_at, u.last_viewed_logs_at, u.is_blocked,
                   (SELECT COUNT(*) FROM activity_logs a WHERE a.user_id = u.id AND a.created_at > u.last_viewed_logs_at) as unread_count
            FROM users u
        `);
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        console.error("Get Users Error:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
}

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, password } = req.body;

        if (!name || !email || !role) {
            return res.status(400).json({ success: false, message: 'Please provide required fields' });
        }

        // Check if updating email conflicts with another user
        const [existing] = await db.query('SELECT * FROM users WHERE email = ? AND id != ?', [email, id]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already in use by another user' });
        }

        const [oldUserRows] = await db.query('SELECT name, role FROM users WHERE id = ?', [id]);
        const oldName = oldUserRows.length > 0 ? oldUserRows[0].name : 'Unknown';
        const oldRole = oldUserRows.length > 0 ? oldUserRows[0].role : 'Unknown';

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.query(
                'UPDATE users SET name = ?, email = ?, role = ?, password = ? WHERE id = ?',
                [name, email, role, hashedPassword, id]
            );
        } else {
            await db.query(
                'UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?',
                [name, email, role, id]
            );
        }

        let logMessage = `Edited details for User: ${name} (${email})`;
        if (oldRole !== role) {
            logMessage += `. Changed role from ${oldRole} to ${role}`;
        }

        await logActivity(req.user?.id, 'UPDATE', 'Users', logMessage);

        res.status(200).json({ success: true, message: 'User updated successfully' });
    } catch (error) {
        console.error("Update User Error:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        // Don't allow self-deletion
        if (req.user.id === parseInt(id)) {
            return res.status(400).json({ success: false, message: 'You cannot delete yourself' });
        }

        const [oldUserRows] = await db.query('SELECT name, email FROM users WHERE id = ?', [id]);
        const deletedName = oldUserRows.length > 0 ? oldUserRows[0].name : 'Unknown';
        const deletedEmail = oldUserRows.length > 0 ? oldUserRows[0].email : 'Unknown';

        await db.query('DELETE FROM users WHERE id = ?', [id]);
        
        await logActivity(req.user?.id, 'DELETE', 'Users', `Deleted user: ${deletedName} (${deletedEmail})`);

        res.status(200).json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error("Delete User Error:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};

const markLogsAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('UPDATE users SET last_viewed_logs_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
        res.status(200).json({ success: true, message: 'Logs marked as read' });
    } catch (error) {
        console.error("Mark Logs Read Error:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};

const toggleBlockUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_blocked } = req.body;
        
        // Don't allow self-blocking
        if (req.user.id === parseInt(id)) {
            return res.status(400).json({ success: false, message: 'You cannot block/unblock yourself' });
        }

        const [oldUserRows] = await db.query('SELECT name, email FROM users WHERE id = ?', [id]);
        if (oldUserRows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const user = oldUserRows[0];

        await db.query('UPDATE users SET is_blocked = ? WHERE id = ?', [is_blocked ? 1 : 0, id]);
        
        const action = is_blocked ? 'Blocked' : 'Unblocked';
        await logActivity(req.user?.id, 'UPDATE', 'Users', `${action} user: ${user.name} (${user.email})`);

        res.status(200).json({ success: true, message: `User ${action.toLowerCase()} successfully` });
    } catch (error) {
        console.error("Toggle Block User Error:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};

module.exports = {
    createUser,
    getUsers,
    updateUser,
    deleteUser,
    markLogsAsRead,
    toggleBlockUser
};
