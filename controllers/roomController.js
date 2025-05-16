const Room = require('../models/Room');
const User = require('../models/User');
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.createRoom = async (req, res) => {
    try {
        const { name, candidateEmail } = req.body;
        const interviewerId = req.user.id;
        const crypto = require('crypto'); 

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
            status: 'pending',
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
// exports.joinRoom = async (req, res) => {
//     try {
//         const roomId = req.params.id;
//         const candidateUserId = req.user.id;

//         const room = await Room.findById(roomId);

//         if (!room) {
//             return res.status(404).json({ message: 'Room not found.' });
//         }

//         if (room.interviewer.toString() === candidateUserId) {
//             return res.status(400).json({ message: 'Interviewer cannot join their own room as a candidate.' });
//         }

//         if (room.candidate && room.candidate.toString() !== candidateUserId) {
//             return res.status(409).json({ message: 'This room already has a candidate assigned.' });
//         }

//         if (room.candidate && room.candidate.toString() === candidateUserId) {
//             await room.populate(['interviewer', 'candidate'], 'name email role');
//             return res.status(200).json({ message: 'You are already the candidate in this room.', room });
//         }

//         room.candidate = candidateUserId;

//         await room.save();
//         await room.populate(['interviewer', 'candidate'], 'name email role');

//         res.status(200).json({ message: 'Successfully joined the room as a candidate.', room });

//     } catch (error) {
//         console.error('Error joining room:', error);
//         if (error.kind === 'ObjectId') {
//             return res.status(400).json({ message: 'Invalid Room ID or User ID format.' });
//         }
//         res.status(500).json({ message: 'Server error while trying to join room.' });
//     }
// };

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
        const interviewerId = req.user.id;

        const rooms = await Room.find({ interviewer: interviewerId })
            .sort({ createdAt: -1 })
            .populate('interviewer', 'name email')
            .populate('candidate', 'name email role')

        res.status(200).json({ rooms: rooms || [] });

    } catch (error) {
        console.error('error fetching rooms for user:', error);
        res.status(500).json({ message: 'server error while fetching rooms.' });
    }
};

exports.updateRoom = async (req, res) => {
    try {
        const roomId = req.params.id;
        const { name, status } = req.body; // fields that can be updated
        const userId = req.user.id;

        const room = await Room.findById(roomId);

        if (!room) {
            return res.status(404).json({ message: 'room not found.' });
        }

        // only the interviewer or an admin can update the room
        if (room.interviewer.toString() !== userId) {
            const currentUser = await User.findById(userId);
            if (!currentUser || currentUser.role !== 'admin') {
                return res.status(403).json({ message: 'not authorized to update this room.' });
            }
        }

        // update only provided fields
        if (name !== undefined) room.name = name;
        if (status !== undefined) {
            const allowedStatuses = ['pending', 'active', 'completed', 'cancelled'];
            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({ message: `invalid status. allowed statuses are: ${allowedStatuses.join(', ')}` });
            }
            room.status = status;
        }

        const updatedRoom = await room.save();
        await updatedRoom.populate('interviewer', 'name email role');

        res.status(200).json({
            message: 'room updated successfully',
            room: updatedRoom
        });

    } catch (error) {
        console.error('error updating room:', error);
        // handle specific mongoose errors
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

        // only the interviewer or an admin can delete the room
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

// task generation using google generative ai
exports.generateTasksForRoom = async (req, res) => {
    try {
        const userId = req.user.id;
        const roomId = req.params.id;
        const { topic, difficulty } = req.body;
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // using gemini/gemma models

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
        // authorization check: user must be interviewer or admin
        if (room.interviewer.toString() !== userId) {
            const currentUser = await User.findById(userId);
            if (!currentUser || currentUser.role !== 'admin') {
                return res.status(403).json({ message: 'not authorized to generate tasks for this room.' });
            }
        }

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemma-3-27b-it" }); // current model for task generation
        const MAX_TASK_LENGTH_CHARS = 1000;

        const prompt = `Generate exactly 1 (one) programming interview task for a candidate with ${difficulty}-level skills on the topic of "${topic}".
The task should be a clear and concise problem description suitable for a live coding interview.
The total length of the task description MUST NOT exceed ${MAX_TASK_LENGTH_CHARS} characters.
Do not include solutions, hints, or any introductory/concluding phrases beyond the task itself.
Format the task starting with "Task:" on a new line. Do NOT use "---" as a separator.
Example:
Task: Describe how to implement a function that reverses a string.
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

        // a previous version had truncation here, ensure it's not needed or re-add if desired
        // if (taskDescription.length > MAX_TASK_LENGTH_CHARS) {
        //     console.warn(`ai generated a task longer than ${MAX_TASK_LENGTH_CHARS} chars. truncating.`);
        //     taskDescription = taskDescription.substring(0, MAX_TASK_LENGTH_CHARS) + "... (truncated)";
        // }

        if (taskDescription.length <= 10) {
            console.warn(`ai generated text but no valid task was extracted or task too short. raw text: ${generatedText.substring(0, 500)}...`);
            return res.status(500).json({ message: 'ai generated a response, but no valid task could be extracted or task is too short. please try a different prompt or parameters.' });
        }

        room.task = taskDescription;
        const updatedRoom = await room.save();

        await updatedRoom.populate('interviewer', 'name email role');

        res.status(200).json({
            message: `successfully generated 1 task using gemma.`, // assuming gemma model based on model id
            room: updatedRoom
        });

    } catch (error) {
        console.error(`error generating tasks with ai for room ${req.params.id}:`, error);
        // handle specific ai api errors
        if (error.message && (error.message.includes('Candidate was blocked') || error.message.includes('SAFETY') || error.message.includes('Recitation'))) {
            return res.status(400).json({ message: 'content generation blocked by ai safety/policy filters. try a different prompt or topic.', details: error.message });
        }
        if (error.message && error.message.includes('quota')) {
            return res.status(429).json({ message: 'api quota exceeded for ai. please try again later.', details: error.message });
        }
        res.status(500).json({ message: 'server error while generating tasks with ai.' });
    }
};