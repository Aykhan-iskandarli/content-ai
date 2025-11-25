const { model } = require('../config/gemini');

const askGemini = async (req, res) => {
    try {
        const { prompt } = req.body;
        
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        res.json({
            success: true,
            response: text
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

module.exports = {
    askGemini
};