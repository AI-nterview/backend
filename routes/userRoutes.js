const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware'); // Импортируем наш protect middleware

router.get('/profile', protect, (req, res) => {
    if (req.user) {
        res.status(200).json({
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role
        });
    } else {
        res.status(404).json({ message: 'User not found.' });
    }
});

module.exports = router;