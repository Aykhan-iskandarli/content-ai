// config/database.js
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mydatabase');
        console.log('✅ MongoDB is successfully connected');
    } catch (error) {
        console.error('❌ MongoDB is not connected:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;