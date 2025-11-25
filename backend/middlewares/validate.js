// middlewares/validation.middleware.js
const validatePrompt = (req, res, next) => {
    const { prompt } = req.body;
    
    if (!prompt || prompt.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Prompt is not empty'
        });
    }
    
    if (prompt.length > 5000) {
        return res.status(400).json({
            success: false,
            message: 'Prompt is very long'
        });
    }
    
    next();
};
// middlewares/validation.middleware.js
const validateContentRequest = (req, res, next) => {
    const { 
        productName, 
        keyFeatures, 
        targetAudience, 
        tone, 
        contentType 
    } = req.body;

    // Required fields check
    if (!productName || !targetAudience || !tone || !contentType) {
        return res.status(400).json({
            success: false,
            message: 'Required fields are missing',
            required: ['productName', 'targetAudience', 'tone', 'contentType']
        });
    }

    // keyFeatures array validation //|| keyFeatures.length < 3 || keyFeatures.length > 5
    if (!Array.isArray(keyFeatures) ) {
        return res.status(400).json({
            success: false,
            message: 'keyFeatures must be an array with 3-5 features'
        });
    }

    // contentType validation
    const validContentTypes = ['Instagram Caption', 'E-commerce Product Description'];
    if (!validContentTypes.includes(contentType)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid contentType',
            validTypes: validContentTypes
        });
    }

    // tone validation
    const validTones = ['Fun and Friendly', 'Formal and Trustworthy', 'Creative and Modern'];
    if (!validTones.includes(tone)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid tone',
            validTones: validTones
        });
    }

    next();
};

module.exports = { 
    validatePrompt,
    validateContentRequest  // New middleware
};
