const express = require('express');
const router = express.Router();
const {requireAuth} = require('../middlewares/user');
const { createCheckoutSession, cancelSubscription } = require('../controllers/stripe');

// router.post('/stripe-webhook', webhookHandler); // Webhook rotası
router.post('/create-checkout-session', requireAuth, createCheckoutSession);
router.post('/cancel-subscription', requireAuth, cancelSubscription);

module.exports = router;