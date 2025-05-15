const jwt = require('jsonwebtoken');
// const User = require('../models/User'); // uncomment if fetching user from db

// middleware to protect routes by verifying jwt token
const protect = async (req, res, next) => {
    let token;

    // check for token in authorization header (bearer token)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // extract token from header
            token = req.headers.authorization.split(' ')[1];

            // verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // add decoded user payload to request object
            req.user = {
                id: decoded.userId,
                name: decoded.name,
                email: decoded.email,
                role: decoded.role
            };

            // this check is more relevant if fetching user from db and user might not exist
            // if (!req.user) {
            //     return res.status(401).json({ message: 'user not found (token verification failed)' });
            // }
            
            next();

        } catch (error) {
            console.error('token verification failed:', error.message);
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'token expired. please log in again.' });
            }
            return res.status(401).json({ message: 'not authorized, token failed.' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'not authorized, no token provided or token malformed.' });
    }
};


// don't need it now
// const authorize = (...roles) => {
//     return (req, res, next) => {
//         // req.user should be set by the 'protect' middleware
//         if (!req.user || !roles.includes(req.user.role)) {
//             return res.status(403).json({ message: `access denied. user role '${req.user ? req.user.role : 'unknown'}' is not authorized.` });
//         }
//         next();
//     };
// };

module.exports = { protect };