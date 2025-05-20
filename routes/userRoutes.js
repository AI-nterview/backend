const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: User
 *   description: User-related routes
 */

/**
 * @swagger
 * /users/profile:
 *   get:
 *     tags: [User]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile returned
 *       401:
 *         description: Unauthorized
 */
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