// server.js
const express = require('express');
const session = require('express-session');
const connectDB = require('./config/database.js');
const geminiRoutes = require('./routes/content.js');
const authRoutes = require('./routes/user');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false, // production-da true
        maxAge: 24 * 60 * 60 * 1000 // 24 saat
    }
}));
// Routes
app.use('/api/gemini', geminiRoutes);
app.use('/api/auth', authRoutes);
// Test route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Express server is work! 🚀'
    });
});



// Server başlat
const startServer = async () => {
    try {
        await connectDB();
        
        app.listen(PORT, () => {
            console.log(`✅ Server ${PORT} is work this port`);
            console.log(`📍 http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Server is not connected', error);
        process.exit(1);
    }
};

startServer();