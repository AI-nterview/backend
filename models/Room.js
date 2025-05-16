const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RoomSchema = new Schema({
    name: {
        type: String,
        trim: true,
        maxlength: 100,
        required: false
    },
    interviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    candidateEmail: { type: String, trim: true, lowercase: true, sparse: true },
    invitationToken: {
        type: String,
        sparse: true
    },
    task: {
        type: String,
        trim: true,
        default: ''
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'completed', 'cancelled', 'awaiting_candidate_registration'],
        default: 'pending'
    },
}, {
    timestamps: true
});

module.exports = mongoose.model('Room', RoomSchema);