const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    try {
        let token = req.headers['authorization'];
        
        if (!token) {
            return res.status(403).json({ success: false, message: 'No token provided' });
        }

        if (token.startsWith('Bearer ')) {
            token = token.slice(7, token.length).trimLeft();
        }

        const secret = process.env.JWT_SECRET || 'crasome_secret_key_123';
        
        jwt.verify(token, secret, async (err, decoded) => {
            if (err) {
                return res.status(401).json({ success: false, message: 'Unauthorized! Invalid Token.' });
            }
            
            try {
                const db = require('../config/db');
                const [users] = await db.query('SELECT is_blocked FROM users WHERE id = ?', [decoded.id]);
                
                if (users.length === 0) {
                    return res.status(401).json({ success: false, message: 'User not found.' });
                }
                
                if (users[0].is_blocked) {
                    return res.status(403).json({ success: false, message: 'Your account is temporarily suspended. Please contact Admin.', is_blocked: true });
                }
                
                req.user = decoded; // Contains id and role
                next();
            } catch (dbError) {
                console.error("DB Error in verifyToken:", dbError);
                return res.status(500).json({ success: false, message: 'Internal Server Error' });
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'super_admin') {
        next();
    } else {
        return res.status(403).json({ success: false, message: 'Require Admin Role!' });
    }
};

module.exports = {
    verifyToken,
    isAdmin
};
