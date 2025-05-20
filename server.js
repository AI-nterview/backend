const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roomRoutes = require('./routes/roomRoutes');
const http = require('http');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { Server } = require("socket.io");
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Genai',
      version: '1.0.0',
      description: 'Web platform for conducting technical interviews featuring live video/audio, a synchronized code editor, and AI-generated coding challenges. (API Documentation)',
    },
    servers: [
      {
        url: process.env.BACKEND_URL,
      },
    ],
  },
  apis: ['./routes/*.js'],  
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

dotenv.config();
const app = express();

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL,
        methods: ["GET", "POST"]
    }
});
console.log('Socket.IO server initialized with CORS for specified origin');

const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('MongoDB connected successfully!'))
    .catch(err => console.error('MongoDB connection error:', err));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.get('/', (req, res) => {
    res.send('Hello from Interview Platform Backend!');
});

// AI generated socket.io logic (need to review)
io.on('connection', (socket) => {
    console.log('Socket.IO: a user connected:', socket.id);

    socket.on('joinRoomAndInitiateCall', (data) => {
        const { roomId, userId } = data;
        socket.join(roomId);
        console.log(`Socket.IO: User ${userId} (socket ${socket.id}) joined room ${roomId}`);

        socket.emit('roomJoined', { roomId: roomId, message: `Successfully joined room ${roomId}` });

        const clientsInRoom = io.sockets.adapter.rooms.get(roomId);
        if (clientsInRoom) {
            clientsInRoom.forEach(clientId => {
                if (clientId !== socket.id) {
                    console.log(`Socket.IO: Notifying ${clientId} to call new user ${socket.id} in room ${roomId}`);
                    io.to(clientId).emit('otherUserToCall', { otherUserId: socket.id });

                    console.log(`Socket.IO: Notifying new user ${socket.id} about existing user ${clientId} in room ${roomId}`);
                    socket.emit('otherUserToCall', { otherUserId: clientId });
                }
            });
        }
    });

    socket.on('webrtc-ice-candidate', (payload) => {
        if (payload.toSocketId && payload.candidate && payload.fromSocketId) {
            io.to(payload.toSocketId).emit('webrtc-ice-candidate', {
                candidate: payload.candidate,
                fromSocketId: payload.fromSocketId
            });
        } else {
            console.error('Socket.IO: Invalid data for webrtc-ice-candidate event:', payload);
        }
    });

    socket.on('joinRoom', (data) => {
        const { roomId, userId } = data;
        socket.join(roomId);
        console.log(`Socket.IO: User ${userId} (ID: ${socket.id}) joined room ${roomId}`);
        socket.emit('roomJoined', { roomId: roomId, message: `You've joined room ${roomId}` });

        const clientsInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
        console.log(`Socket.IO: Users in room ${roomId}:`, clientsInRoom);

        if (clientsInRoom.length > 1) {
            const otherClientIds = clientsInRoom.filter(id => id !== socket.id);
            if (otherClientIds.length > 0) {
                const existingUserId = otherClientIds[0];

                console.log(`Socket.IO: Telling NEW user ${socket.id} to call EXISTING user ${existingUserId}`);
                socket.emit('initiateCallToUser', { otherUserId: existingUserId });
            }
        }
    });


    socket.on('codeChange', (data) => {
        const { roomId, code, userId } = data;

        if (roomId && typeof code === 'string' && userId) {
            socket.to(roomId).emit('codeChange', { code: code, userId: userId });
        } else {
            console.error('Socket.IO: Invalid data for codeChange event. Data:', data, 'Socket ID:', socket.id);
        }
    });

    socket.on('sendSignalOffer', (payload) => {
        console.log(`Socket.IO: User ${payload.callerId} sending OFFER to ${payload.userToSignal}`);
        io.to(payload.userToSignal).emit('signalOffer', { signal: payload.signal, callerId: payload.callerId });
    });

    socket.on('sendSignalAnswer', (payload) => {
        console.log(`Socket.IO: User ${payload.responderId} sending ANSWER to ${payload.callerId}`);
        io.to(payload.callerId).emit('signalAnswer', { signal: payload.signal, responderId: payload.responderId });
    });

    socket.on('disconnecting', () => {
        socket.rooms.forEach(roomId => {
            if (roomId !== socket.id) {
                console.log(`Socket.IO: User ${socket.id} disconnecting from room ${roomId}`);
                socket.to(roomId).emit('peerDisconnected', { peerId: socket.id });
            }
        });
    });

    socket.on('disconnect', () => {
        console.log(`Socket.IO: User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Socket.IO is ready and listening on this server.`);
});