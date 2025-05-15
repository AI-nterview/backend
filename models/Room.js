const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RoomSchema = new Schema({
    name: {
        type: String,
        trim: true,
        maxlength: 100,
        required: false
    },
    interviewer: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    candidate: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    task: {
        type: String,
        trim: true,
        default: ''
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'completed', 'cancelled'],
        default: 'pending'
    },
}, {
    timestamps: true
});

module.exports = mongoose.model('Room', RoomSchema);