// server.js
const express = require('express');
const connectDB = require('./config/database.js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const geminiRoutes = require('./routes/content');
app.use('/api/gemini', geminiRoutes);

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