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
        
        jwt.verify(token, secret, (err, decoded) => {
            if (err) {
                return res.status(401).json({ success: false, message: 'Unauthorized! Invalid Token.' });
            }
            req.user = decoded; // Contains id and role
            next();
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
