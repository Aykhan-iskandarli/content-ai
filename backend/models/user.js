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
      stripe: {
        customerId: {
            type: String,  // cus_xxxxx
            default: null
        },
        subscriptionId: {
            type: String,  // sub_xxxxx
            default: null
        },
        priceId: {
            type: String,  // price_xxxxx (hansı plan)
            default: null
        },
        currentPeriodEnd: {
            type: Date,    // Subscription bitəndə
            default: null
        },
        status: {
            type: String,  // active, canceled, past_due
            enum: ['active', 'trialing', 'canceled', 'past_due', 'unpaid', null],
            default: null
        },
        cancelAtPeriodEnd: {
            type: Boolean,  // Ay sonunda ləğv olacaq?
            default: false
        }
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


userSchema.methods.updatePlanLimits = function() {
    switch(this.plan) {
        case 'enterprise':
            this.limits.dailyTokens = 1000000;
            this.limits.monthlyTokens = 10000000;
            this.limits.monthlyGenerations = -1; // unlimited
            this.limits.requestsPerMinute = 120;
            break;
        case 'premium':
            this.limits.dailyTokens = 100000;
            this.limits.monthlyTokens = 3000000;
            this.limits.monthlyGenerations = 100;
            this.limits.requestsPerMinute = 90;
            break;
        default: // free
            this.limits.dailyTokens = 32000;
            this.limits.monthlyTokens = 1000000;
            this.limits.monthlyGenerations = 10;
            this.limits.requestsPerMinute = 60;
    }
    return this.save();
};

userSchema.methods.hasActiveSubscription = function() {
    if (this.plan === 'free') return false;
    
    return this.stripe.status === 'active' && 
           this.stripe.currentPeriodEnd && 
           new Date(this.stripe.currentPeriodEnd) > new Date();
};

userSchema.methods.checkSubscriptionExpiry = function() {
    if (!this.stripe.currentPeriodEnd) return false;
    
    if (new Date(this.stripe.currentPeriodEnd) < new Date() && 
        this.plan !== 'free') {
        
        this.plan = 'free';
        this.stripe.status = 'canceled';
        this.updatePlanLimits();
        return true; // expired və downgrade oldu
    }
    return false; // hələ aktivdir
};

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
    
    // Enterprise unlimited check
    const isUnlimited = this.plan === 'enterprise' && 
                       this.limits.monthlyGenerations === -1;
    
    return {
        dailyRemaining: this.limits.dailyTokens - this.tokenUsage.daily.count,
        monthlyRemaining: this.limits.monthlyTokens - this.tokenUsage.monthly.count,
        canGenerate: isUnlimited || (
            this.tokenUsage.daily.count < this.limits.dailyTokens && 
            this.tokenUsage.monthly.count < this.limits.monthlyTokens &&
            (this.limits.monthlyGenerations === -1 || 
             this.monthlyGenerationCount < this.limits.monthlyGenerations)
        ),
        isUnlimited: isUnlimited
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
        limits: {
            generations: this.limits.monthlyGenerations === -1 ? 'Unlimited' : this.limits.monthlyGenerations,
            dailyTokens: this.limits.dailyTokens,
            monthlyTokens: this.limits.monthlyTokens
        },
        subscription: this.stripe.status ? {
            status: this.stripe.status,
            endsAt: this.stripe.currentPeriodEnd,
            willCancel: this.stripe.cancelAtPeriodEnd
        } : null,
        createdAt: this.createdAt
    };
};
userSchema.pre('save', function() {
    this.updatedAt = Date.now();
});
module.exports = mongoose.model('User', userSchema);