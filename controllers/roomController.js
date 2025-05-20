const Room = require('../models/Room');
const User = require('../models/User');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const crypto = require('crypto');

exports.createRoom = async (req, res) => {
    try {
        const { name, candidateEmail } = req.body;
        const interviewerId = req.user.id;

        if (!interviewerId) {
            return res.status(401).json({ message: 'Not authorized to create a room.' });
        }

        if (!candidateEmail) {
            return res.status(400).json({ message: 'Candidate email is required to create a room.' });
        }

        const normalizedCandidateEmail = candidateEmail.toLowerCase().trim();

        if (req.user.email === normalizedCandidateEmail) {
            return res.status(400).json({ message: 'Interviewer cannot invite themselves as a candidate.' });
        }

        let existingCandidate = await User.findOne({ email: normalizedCandidateEmail });

        const roomDetails = {
            name: name || `Interview Room ${Date.now()}`,
            interviewer: interviewerId,
            candidateEmail: normalizedCandidateEmail,
            // status is determined below based on existingCandidate
        };

        let invitationToken = null;

        if (existingCandidate) {
            roomDetails.candidate = existingCandidate._id;
            roomDetails.status = 'pending';
        } else {
            invitationToken = crypto.randomBytes(20).toString('hex');
            roomDetails.invitationToken = invitationToken;
            roomDetails.status = 'awaiting_candidate_registration';
        }

        const newRoom = new Room(roomDetails);
        const savedRoom = await newRoom.save();

        await savedRoom.populate('interviewer', 'name email role');
        if (savedRoom.candidate) {
            await savedRoom.populate('candidate', 'name email role');
        }

        if (existingCandidate) {
            return res.status(201).json({
                message: 'Room created and candidate assigned.',
                room: savedRoom
            });
        } else {
            return res.status(201).json({
                message: 'Room created. Candidate not found. Please share the invitation link with the candidate.',
                room: savedRoom,
                invitationToken: invitationToken
            });
        }

    } catch (error) {
        console.error('Error creating room:', error);
        res.status(500).json({ message: 'Server error while creating room.' });
    }
};

exports.getRoomById = async (req, res) => {
    try {
        const roomId = req.params.id;
        const currentUserId = req.user.id;

        const room = await Room.findById(roomId)
            .populate('interviewer', 'name email role')
            .populate('candidate', 'name email role');

        if (!room) {
            return res.status(404).json({ message: 'Room not found.' });
        }

        const isInterviewer = room.interviewer?._id.toString() === currentUserId;
        const isCandidate = room.candidate?._id.toString() === currentUserId;

        let isAdmin = false;
        if (!isInterviewer && !isCandidate) {
            isAdmin = req.user.role === 'admin';
        }

        if (!isInterviewer && !isCandidate && !isAdmin) {
            return res.status(403).json({ message: 'Not authorized to access this room.' });
        }

        if (isInterviewer && room.status === 'awaiting_candidate_registration' && !room.candidate) {
            const roomObject = room.toObject();
            roomObject.awaitingInfo = `Awaiting registration from ${room.candidateEmail}. Invitation token: ${room.invitationToken || 'N/A (should be set)'}`;
            return res.status(200).json(roomObject);
        }

        res.status(200).json(room);

    } catch (error) {
        console.error('Error fetching room by id:', error);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid room id format.' });
        }
        res.status(500).json({ message: 'Server error while fetching room.' });
    }
};

exports.getAllRoomsForUser = async (req, res) => {
    try {
        const userId = req.user.id;
        // Pagination parameters (page, limit, skip) are removed.
        // The find query will now return all matching documents.

        const rooms = await Room.find({
            $or: [
                { interviewer: userId },
                { candidate: userId }
            ]
        })
            .sort({ createdAt: -1 })
            // .skip(skip) and .limit(limit) are removed
            .populate('interviewer', 'name email')
            .populate('candidate', 'name email role');

        // totalRooms, currentPage, totalPages are removed from the response.
        res.status(200).json({
            rooms: rooms || []
            // No pagination fields in the response
        });

    } catch (error) {
        console.error('Error fetching rooms for user:', error);
        res.status(500).json({ message: 'Server error while fetching rooms.' });
    }
};

exports.updateRoom = async (req, res) => {
    try {
        const roomId = req.params.id;
        const { name, status } = req.body;
        const userId = req.user.id;

        const room = await Room.findById(roomId);

        if (!room) {
            return res.status(404).json({ message: 'Room not found.' });
        }

        if (room.interviewer.toString() !== userId) {
            const currentUser = await User.findById(userId);
            if (!currentUser || currentUser.role !== 'admin') {
                return res.status(403).json({ message: 'Not authorized to update this room.' });
            }
        }

        if (name !== undefined) room.name = name;
        if (status !== undefined) {
            const allowedStatuses = ['pending', 'active', 'completed', 'cancelled', 'awaiting_candidate_registration']; // Added 'awaiting_candidate_registration' for completeness
            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({ message: `invalid status. allowed statuses are: ${allowedStatuses.join(', ')}` });
            }
            room.status = status;
        }

        const updatedRoom = await room.save();
        // Populate after saving to ensure populated fields are on the returned object
        await updatedRoom.populate('interviewer', 'name email role');
        if (updatedRoom.candidate) { // Check if candidate exists before populating
            await updatedRoom.populate('candidate', 'name email role');
        }


        res.status(200).json({
            message: 'room updated successfully',
            room: updatedRoom
        });

    } catch (error) {
        console.error('error updating room:', error);
        if (error.kind === 'ObjectId' && error.path === '_id') {
            return res.status(400).json({ message: 'invalid room id format.' });
        }
        if (error.kind === 'ObjectId' && error.path === 'candidate') {
            return res.status(400).json({ message: 'invalid candidate id format.' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'server error while updating room.' });
    }
}
exports.deleteRoom = async (req, res) => {
    try {
        const roomId = req.params.id;
        const userId = req.user.id;

        const room = await Room.findById(roomId);

        if (!room) {
            return res.status(404).json({ message: 'room not found.' });
        }

        if (room.interviewer.toString() !== userId) {
            const currentUser = await User.findById(userId);
            if (!currentUser || currentUser.role !== 'admin') {
                return res.status(403).json({ message: 'not authorized to delete this room.' });
            }
        }

        await Room.findByIdAndDelete(roomId);

        res.status(200).json({ message: 'room deleted successfully' });

    } catch (error) {
        console.error('error deleting room:', error);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'invalid room id format.' });
        }
        res.status(500).json({ message: 'server error while deleting room.' });
    }
};

exports.generateTasksForRoom = async (req, res) => {
    try {
        const userId = req.user.id;
        const roomId = req.params.id;
        const { topic, difficulty } = req.body;
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!GEMINI_API_KEY) {
            return res.status(500).json({ message: 'ai task generation is not configured on the server.' });
        }

        if (!topic || !difficulty) {
            return res.status(400).json({ message: 'topic and difficulty are required.' });
        }

        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({ message: 'room not found.' });
        }
        if (room.interviewer.toString() !== userId) {
            const currentUser = await User.findById(userId);
            if (!currentUser || currentUser.role !== 'admin') {
                return res.status(403).json({ message: 'not authorized to generate tasks for this room.' });
            }
        }

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemma-3-27b-it" });
        const MAX_TASK_LENGTH_CHARS = 1000;

        const prompt = `Generate exactly 1 (one) programming interview task for a candidate with ${difficulty}-level skills on the topic of "${topic}".
The task must follow the style and structure of a Codewars kata.

Output must include the following sections in this strict order:

1. A concise task description starting with "Task:", fully commented out using JavaScript line comments (//). Do NOT include introductory or concluding phrases. The description should be clear and no longer than ${MAX_TASK_LENGTH_CHARS} characters.

2. Predefined input variable needed to call the function.

3. A function definition with the correct signature, including a "// your code here" comment inside the body.

Do NOT include solutions, hints, explanations, or separators like "---".

Example output:

// Task: Implement a function that returns true if a number is even, otherwise false.

const num = 4;

function isEven(num) {
  // your code here
}

return isEven(num);
`;

        const generationConfig = {
            temperature: 0.9,
        };

        const result = await model.generateContent(prompt, generationConfig);
        const geminiResponse = await result.response;
        let generatedText = geminiResponse.text();

        if (!generatedText || generatedText.trim() === "") {
            console.error('ai response content is empty. full response:', geminiResponse);
            if (geminiResponse.promptFeedback && geminiResponse.promptFeedback.blockReason) {
                return res.status(400).json({ message: `content generation blocked by ai. reason: ${geminiResponse.promptFeedback.blockReason}. try a different prompt.` });
            }
            return res.status(500).json({ message: 'failed to generate tasks. ai response was empty.' });
        }

        let taskDescription = generatedText.replace(/^Task:\s*/im, '').trim();

        if (taskDescription.length <= 10) {
            console.warn(`ai generated text but no valid task was extracted or task too short. raw text: ${generatedText.substring(0, 500)}...`);
            return res.status(500).json({ message: 'ai generated a response, but no valid task could be extracted or task is too short. please try a different prompt or parameters.' });
        }

        room.task = taskDescription;
        const updatedRoom = await room.save();

        await updatedRoom.populate('interviewer', 'name email role');
        if (updatedRoom.candidate) {
            await updatedRoom.populate('candidate', 'name email role');
        }

        res.status(200).json({
            message: `Task successfully generated.`,
            room: updatedRoom
        });

    } catch (error) {
        console.error(`error generating tasks with ai for room ${req.params.id}:`, error);
        if (error.message && (error.message.includes('Candidate was blocked') || error.message.includes('SAFETY') || error.message.includes('Recitation'))) {
            return res.status(400).json({ message: 'Content generation blocked by AI safety/policy filters. Try a different prompt or topic.', details: error.message });
        }
        if (error.message && error.message.includes('quota')) {
            return res.status(429).json({ message: 'API quota exceeded for AI. Please try again later.', details: error.message });
        }
        res.status(500).json({ message: 'Server error while generating tasks with AI.' });
    }
};