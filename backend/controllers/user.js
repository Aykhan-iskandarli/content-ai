// controllers/auth.controller.js - UPDATED
const User = require('../models/user');

// Register
const register = async (req, res) => {
    try {
        const { email, name, password } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }
        
        // Create user with hashed password
        const user = await User.create({
            email,
            name,
            password: await User.hashPassword(password)  // Static method
        });
        
        // Generate token and response
        res.status(201).json({
            success: true,
            token: user.generateToken(),           // Instance method
            user: user.getPublicProfile()          // Instance method
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Registration failed',
            error: error.message
        });
    }
};

// Login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        // Check password
        const isValid = await user.comparePassword(password);  // Instance method
        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        // Response
        res.json({
            success: true,
            token: user.generateToken(),          // Instance method
            user: user.getPublicProfile()         // Instance method
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
};

module.exports = { register, login };