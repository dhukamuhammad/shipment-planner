const db = require('../../config/db');
const bcrypt = require('bcrypt');

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

        res.status(201).json({ success: true, message: 'User created successfully' });
    } catch (error) {
        console.error("Create User Error:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};

const getUsers = async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, name, email, role, created_at FROM users');
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

        await db.query('DELETE FROM users WHERE id = ?', [id]);
        res.status(200).json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error("Delete User Error:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};

module.exports = {
    createUser,
    getUsers,
    updateUser,
    deleteUser
};
