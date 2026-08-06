const db = require('../../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User Not found.' });
        }

        const user = users[0];

        const passwordIsValid = await bcrypt.compare(password, user.password);

        if (!passwordIsValid) {
            return res.status(401).json({
                success: false,
                token: null,
                message: 'Invalid Password!'
            });
        }

        const secret = process.env.JWT_SECRET || 'crasome_secret_key_123';
        
        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.name, email: user.email },
            secret,
            { expiresIn: 86400 } // 24 hours
        );

        res.status(200).json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            token: token
        });
    } catch (error) {
        console.error("Login Error: ", error);
        res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};

module.exports = {
    login
};
