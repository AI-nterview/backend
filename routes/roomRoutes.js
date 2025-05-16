const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { protect } = require('../middleware/authMiddleware'); // authentication middleware

// create a new room (protected)
// post /api/rooms
router.post('/', protect, roomController.createRoom);

// get all rooms for the current user (interviewer) (protected)
// get /api/rooms/my-rooms
router.get('/my-rooms', protect, roomController.getAllRoomsForUser);

// get a specific room by id (protected)
// get /api/rooms/:id
router.get('/:id', protect, roomController.getRoomById);

// update a specific room by id (protected)
// put /api/rooms/:id
router.put('/:id', protect, roomController.updateRoom); // add validators if needed later

// delete a specific room by id (protected)
// delete /api/rooms/:id
router.delete('/:id', protect, roomController.deleteRoom);


// generate ai tasks for a specific room (protected)
// post /api/rooms/:id/generate-tasks
router.post('/:id/generate-tasks', protect, roomController.generateTasksForRoom); 

module.exports = router;