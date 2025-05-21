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

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/rooms', roomRoutes);
app.get('/', (req, res) => {
    res.send('Hello from Interview Platform Backend!');
});

io.on('connection', (socket) => {
    console.log('Socket.IO: a user connected:', socket.id);

    socket.on('joinRoom', (data) => {
        const { roomId, userId } = data;
        socket.join(roomId);
        console.log(`Socket.IO: User ${userId} (ID: ${socket.id}) joined room ${roomId}`);

        const otherClientsInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || [])
                                       .filter(id => id !== socket.id);
        console.log(`Socket.IO: Other clients in room ${roomId} for new user ${socket.id}:`, otherClientsInRoom);
        socket.emit('existingUsers', otherClientsInRoom);
        socket.to(roomId).emit('userJoined', { newUserId: socket.id });
        socket.emit('roomJoined', { roomId: roomId, message: `You've joined room ${roomId}` }); // Можно оставить для UI
    });

    socket.on('webrtc-ice-candidate', (payload) => {
        if (payload.toSocketId && payload.candidate && payload.fromSocketId) {
            io.to(payload.toSocketId).emit('webrtc-ice-candidate', {
                candidate: payload.candidate,
                fromSocketId: payload.fromSocketId // Это важно!
            });
        } else {
            console.error('Socket.IO: Invalid data for webrtc-ice-candidate event:', payload);
        }
    });

    socket.on('sendSignalOffer', (payload) => {
        console.log(`Socket.IO: User ${payload.callerId} sending OFFER to ${payload.userToSignal}`);
        io.to(payload.userToSignal).emit('signalOffer', {
            signal: payload.signal,
            callerId: payload.callerId // Важно, чтобы принимающий знал, от кого оффер
        });
    });

    socket.on('sendSignalAnswer', (payload) => {
        console.log(`Socket.IO: User ${payload.responderId} sending ANSWER to ${payload.callerId}`);
        io.to(payload.callerId).emit('signalAnswer', {
            signal: payload.signal,
            responderId: payload.responderId // Важно, чтобы принимающий знал, от кого ответ
        });
    });

    socket.on('codeChange', (data) => {
        const { roomId, code, userId } = data;
        if (roomId && typeof code === 'string' && userId) {
            socket.to(roomId).emit('codeChange', { code: code, userId: userId });
        } else {
            console.error('Socket.IO: Invalid data for codeChange event. Data:', data, 'Socket ID:', socket.id);
        }
    });

    socket.on('disconnecting', () => {
        socket.rooms.forEach(roomId => {
            if (roomId !== socket.id) { // Не оповещать о выходе из "личной" комнаты сокета
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