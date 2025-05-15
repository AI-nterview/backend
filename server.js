// Импорт необходимых модулей
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roomRoutes = require('./routes/roomRoutes');
const http = require('http');
const { Server } = require("socket.io");

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);

// --- Инициализируем Socket.IO на этом httpServer ---
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5174",
        methods: ["GET", "POST"]
        // credentials: true // Оставим пока закомментированным, если не используем куки для сокетов
    }
});
console.log('Socket.IO server initialized with CORS for specified origin');

const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI, { /* ... твои опции ... */ })
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

        // Найти другого пользователя в комнате (если есть) 
        const clientsInRoom = io.sockets.adapter.rooms.get(roomId);
        if (clientsInRoom) {
            clientsInRoom.forEach(clientId => {
                if (clientId !== socket.id) {
                    // Этот клиент (socket.id) только что вошел.
                    // Оповещаем другого клиента (clientId), чтобы он сделал оффер этому новому (socket.id).
                    console.log(`Socket.IO: Notifying ${clientId} to call new user ${socket.id} in room ${roomId}`);
                    io.to(clientId).emit('otherUserToCall', { otherUserId: socket.id });

                    // И наоборот, оповещаем нового (socket.id) о существующем (clientId), чтобы он был готов принять оффер
                    // (хотя в текущей логике фронтенда новый пользователь не инициирует звонок сам,
                    // но это может быть полезно для симметричности или будущих изменений)
                    console.log(`Socket.IO: Notifying new user ${socket.id} about existing user ${clientId} in room ${roomId}`);
                    socket.emit('otherUserToCall', { otherUserId: clientId });
                    // ^^^ ВАЖНО: Эта строка может привести к тому, что оба попытаются позвонить друг другу.
                    // Нужно более умное решение, кто инициатор.
                    // Пока что упростим: ПЕРВЫЙ в комнате ждет, ВТОРОЙ инициирует звонок ПЕРВОМУ.
                    // Или, как в коде клиента: тот, кто УЖЕ в комнате, звонит НОВОМУ.
                    // Давай сделаем так: тот, кто уже был в комнате, позвонит новому.
                }
            });
        }
        // Более простая логика для MVP:
        // Когда второй пользователь входит, первый (кто уже там) инициирует звонок второму.
        // Или наоборот: второй (только что вошедший) инициирует звонок первому.
        // В коде фронтенда сейчас: existing user calls the new user.
        // Значит, сервер должен новому пользователю прислать ID существующего.
        // А существующему - ID нового.

        // Пересмотренная логика для joinRoomAndInitiateCall
        // Очистим предыдущий clientsInRoom.forEach для ясности
    });

    // Новая, более простая логика для joinRoom, где инициатор определяется проще
    // Старый 'joinRoom' удаляем или переименовываем
    socket.on('joinRoom', (data) => { // Клиент вызывает это событие
        const { roomId, userId } = data; // userId - это socket.id клиента, который присоединяется
        socket.join(roomId);
        console.log(`Socket.IO: User ${userId} (ID: ${socket.id}) joined room ${roomId}`);
        socket.emit('roomJoined', { roomId: roomId, message: `You've joined room ${roomId}` });

        const clientsInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
        console.log(`Socket.IO: Users in room ${roomId}:`, clientsInRoom);

        // Если после присоединения этого сокета в комнате стало больше одного человека
        if (clientsInRoom.length > 1) {
            // Находим ID другого(их) пользователя(ей)
            const otherClientIds = clientsInRoom.filter(id => id !== socket.id);
            if (otherClientIds.length > 0) {
                const existingUserId = otherClientIds[0]; // Берем первого существующего пользователя

                // Говорим НОВОМУ пользователю (socket.id) позвонить СУЩЕСТВУЮЩЕМУ (existingUserId)
                console.log(`Socket.IO: Telling NEW user ${socket.id} to call EXISTING user ${existingUserId}`);
                socket.emit('initiateCallToUser', { otherUserId: existingUserId });
            }
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