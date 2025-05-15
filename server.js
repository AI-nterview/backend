// Импорт необходимых модулей
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roomRoutes = require('./routes/roomRoutes');


// Загрузка переменных окружения из файла .env
dotenv.config();

// Инициализация Express приложения
const app = express();

// Middleware
app.use(cors()); // Разрешает CORS-запросы (важно для взаимодействия с фронтендом)
app.use(express.json()); // Позволяет парсить JSON в теле запросов
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);


// Подключение к MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // useCreateIndex: true, // Эта опция больше не поддерживается в новых версиях Mongoose
    // useFindAndModify: false // Эта опция больше не поддерживается в новых версиях Mongoose
})
    .then(() => console.log('MongoDB connected successfully!'))
    .catch(err => console.error('MongoDB connection error:', err));

// Простой тестовый роут
app.get('/', (req, res) => {
    res.send('Hello from Interview Platform Backend!');
});

// Запуск сервера
const PORT = process.env.PORT || 5000; // Используем порт из .env или 5000 по умолчанию
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});