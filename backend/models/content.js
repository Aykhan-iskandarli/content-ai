// models/ContentGeneration.model.js
const mongoose = require('mongoose');

const contentGenerationSchema = new mongoose.Schema({
    // User reference
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true  // Fast queries by user
    },
    
    // Input parameters
    input: {
        productName: {
            type: String,
            required: true,
            trim: true
        },
        keyFeatures: [{
            type: String,
            trim: true
        }],
        targetAudience: {
            type: String,
            required: true,
            trim: true
        },
        tone: {
            type: String,
            required: true,
            enum: ['Fun and Friendly', 'Formal and Trustworthy', 'Creative and Modern']
        },
        contentType: {
            type: String,
            required: true,
            enum: ['Instagram Caption', 'E-commerce Product Description']
        }
    },
    
    // Generated output
    generatedContent: {
        type: String,
        required: true
    },
    
    // Token usage tracking
    tokens: {
        inputTokens: { type: Number, default: 0 },
        outputTokens: { type: Number, default: 0 },
        totalTokens: { type: Number, default: 0 }
    },
    
    // API response metadata
    apiResponse: {
        model: { 
            type: String, 
            default: 'gemini-pro' 
        },
        finishReason: {
            type: String,
            enum: ['STOP', 'MAX_TOKENS', 'SAFETY', 'RECITATION', 'OTHER']
        },
        responseTime: Number,  // milliseconds
        temperature: { type: Number, default: 0.7 },
        maxOutputTokens: { type: Number, default: 1000 }
    },
    
    // User feedback
    feedback: {
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        comment: String,
        isUseful: Boolean,
        reportedAt: Date
    },
    
    // Status flags
    status: {
        type: String,
        enum: ['completed', 'failed', 'pending'],
        default: 'completed'
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    
    // Error tracking
    error: {
        message: String,
        code: String,
        occurredAt: Date
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true  // Fast sorting by date
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes for better query performance
contentGenerationSchema.index({ userId: 1, createdAt: -1 });
contentGenerationSchema.index({ 'input.contentType': 1 });
contentGenerationSchema.index({ status: 1 });

// Virtual for age of content
contentGenerationSchema.virtual('ageInDays').get(function() {
    return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Update timestamp on save
contentGenerationSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('ContentGeneration', contentGenerationSchema);