// routes/content.js
const express = require('express');
const router = express.Router();
const { generateContent, getApiStatus } = require('../controllers/content');
const { validateContentRequest } = require('../middlewares/validate');
const { optionalAuth } = require('../middlewares/user');

router.post('/generate-content', optionalAuth, validateContentRequest, generateContent);
router.get('/status', optionalAuth, getApiStatus);
module.exports = router;