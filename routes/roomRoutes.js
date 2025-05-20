const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { protect } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Rooms
 *   description: Room management routes
 */

/**
 * @swagger
 * /rooms:
 *   post:
 *     tags: [Rooms]
 *     summary: Create a new room
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *     responses:
 *       201:
 *         description: Room created
 *       400:
 *         description: Bad request
 */
router.post('/', protect, roomController.createRoom);

/**
 * @swagger
 * /rooms/my-rooms:
 *   get:
 *     tags: [Rooms]
 *     summary: Get all rooms created by the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of rooms
 *       401:
 *         description: Unauthorized
 */
router.get('/my-rooms', protect, roomController.getAllRoomsForUser);

/**
 * @swagger
 * /rooms/{id}:
 *   get:
 *     tags: [Rooms]
 *     summary: Get a specific room by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     responses:
 *       200:
 *         description: Room data
 *       404:
 *         description: Room not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', protect, roomController.getRoomById);

/**
 * @swagger
 * /rooms/{id}:
 *   put:
 *     tags: [Rooms]
 *     summary: Update a room by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Room updated
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Room not found
 */
router.put('/:id', protect, roomController.updateRoom); // add validators if needed later

/**
 * @swagger
 * /rooms/{id}:
 *   delete:
 *     tags: [Rooms]
 *     summary: Delete a room by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     responses:
 *       200:
 *         description: Room deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Room not found
 */
router.delete('/:id', protect, roomController.deleteRoom);


/**
 * @swagger
 * /rooms/{id}/generate-tasks:
 *   post:
 *     tags: [Rooms]
 *     summary: Generate AI tasks for a specific room
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     responses:
 *       200:
 *         description: AI tasks generated
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Room not found
 */
router.post('/:id/generate-tasks', protect, roomController.generateTasksForRoom); 

module.exports = router;