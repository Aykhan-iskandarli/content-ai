// models/User.model.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
    // Basic info
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    
    // Subscription info
    plan: {
        type: String,
        enum: ['free', 'premium', 'enterprise'],
        default: 'free'
    },
    
    // Generation limits
    monthlyGenerationCount: {
        type: Number,
        default: 0
    },
    lastResetDate: {
        type: Date,
        default: Date.now
    },
    
    // Token tracking
    tokenUsage: {
        daily: {
            count: { type: Number, default: 0 },
            lastReset: { type: Date, default: Date.now }
        },
        monthly: {
            count: { type: Number, default: 0 },
            lastReset: { type: Date, default: Date.now }
        },
        total: { type: Number, default: 0 }
    },
    
    // API limits based on plan
    limits: {
        dailyTokens: { type: Number, default: 32000 },      // Free tier
        monthlyTokens: { type: Number, default: 1000000 },  // Free tier
        requestsPerMinute: { type: Number, default: 60 },   // RPM
        monthlyGenerations: { type: Number, default: 10 }   // Free tier content limit
    },
    
    // Account status
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Check if monthly reset needed
userSchema.methods.checkMonthlyReset = function() {
    const now = new Date();
    const lastReset = new Date(this.lastResetDate);
    
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
        this.monthlyGenerationCount = 0;
        this.tokenUsage.monthly.count = 0;
        this.tokenUsage.monthly.lastReset = now;
        this.lastResetDate = now;
        return true;
    }
    return false;
};

// Check if daily reset needed
userSchema.methods.checkDailyReset = function() {
    const now = new Date();
    const lastReset = new Date(this.tokenUsage.daily.lastReset);
    
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
        this.tokenUsage.daily.count = 0;
        this.tokenUsage.daily.lastReset = now;
        return true;
    }
    return false;
};

// Check token availability
userSchema.methods.hasTokensRemaining = function() {
    this.checkDailyReset();
    this.checkMonthlyReset();
    
    return {
        dailyRemaining: this.limits.dailyTokens - this.tokenUsage.daily.count,
        monthlyRemaining: this.limits.monthlyTokens - this.tokenUsage.monthly.count,
        canGenerate: this.tokenUsage.daily.count < this.limits.dailyTokens && 
                    this.tokenUsage.monthly.count < this.limits.monthlyTokens &&
                    this.monthlyGenerationCount < this.limits.monthlyGenerations
    };
};

// Check generation limit
userSchema.methods.canGenerateContent = function() {
    this.checkMonthlyReset();
    return this.monthlyGenerationCount < this.limits.monthlyGenerations;
};


// Password hash method (static - yeni user üçün)
userSchema.statics.hashPassword = async function(password) {
    return await bcrypt.hash(password, 10);
};

// Password compare method (instance method)
userSchema.methods.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

// Generate JWT token method
userSchema.methods.generateToken = function() {
    return jwt.sign(
        { id: this._id },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
};

// Get public profile (password-suz məlumat)
userSchema.methods.getPublicProfile = function() {
    return {
        id: this._id,
        name: this.name,
        email: this.email,
        plan: this.plan,
        createdAt: this.createdAt
    };
};
userSchema.pre('save', function() {
    this.updatedAt = Date.now();
});
module.exports = mongoose.model('User', userSchema);