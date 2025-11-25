// routes/gemini.routes.js
const express = require('express');
const router = express.Router();
const { askGemini } = require('../controllers/content.js');

router.post('/ask', askGemini);

module.exports = router;