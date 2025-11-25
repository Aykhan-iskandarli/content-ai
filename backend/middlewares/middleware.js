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

module.exports = { validatePrompt };