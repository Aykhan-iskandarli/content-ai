// controllers/stripe.controller.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/user');


const createCheckoutSession = async (req, res) => {
    
const PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID.trim();
const ENTERPRISE_PRICE_ID = process.env.STRIPE_ENTERPRISE_PRICE_ID.trim();
    try {
        const user = req.user;
       const priceId = req.body.priceId.trim();
             console.log(priceId, "price");
            console.log(PREMIUM_PRICE_ID, "PREMIUM_PRICE_ID");
        // Plan validation
        if (priceId !== PREMIUM_PRICE_ID && priceId !== ENTERPRISE_PRICE_ID ) {
       
            return res.status(400).json({ 
                success: false,
                message: "Invalid plan selection" 
            });
        }
        
        // Stripe customer yaratmaq (əgər yoxdursa)
        let customerId = user.stripe.customerId;
        console.log(customerId, "customerId");
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: { userId: user._id.toString() }
            });
            customerId = customer.id;
            user.stripe.customerId = customerId;
            await user.save();
        }
        
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            line_items: [{ price: priceId, quantity: 1 }],
            customer: customerId,
            client_reference_id: user._id.toString(),
            success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`, // {} əlavə
            cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
            metadata: {
                 test_mode: 'true' // Bəzi hallarda lazımdır
            },
        });
        
        res.json({ 
            success: true,
            url: session.url 
        });
    } catch (error) {
        console.error('Checkout session error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
};

const webhookHandler = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    
    try {
        event = stripe.webhooks.constructEvent(
            req.body, 
            sig, 
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.log(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            const userId = session.client_reference_id;
            
            if (!session.subscription) break;
            
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            const priceId = subscription.items.data[0].price.id;
            const planName = priceId === PREMIUM_PRICE_ID ? 'premium' : 'enterprise';
            
            const user = await User.findById(userId);
            if (user) {
                user.stripe.customerId = session.customer;
                user.stripe.subscriptionId = session.subscription;
                user.stripe.status = subscription.status;
                user.stripe.priceId = priceId;
                user.stripe.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
                user.plan = planName;
                await user.updatePlanLimits();
                // await user.save(); // updatePlanLimits already saves
            }
            break;
            
        case 'customer.subscription.updated':
            const subUpdated = event.data.object;
            const userToUpdate = await User.findOne({ 
                'stripe.subscriptionId': subUpdated.id 
            });
            
            if (userToUpdate) {
                userToUpdate.stripe.status = subUpdated.status;
                userToUpdate.stripe.currentPeriodEnd = new Date(subUpdated.current_period_end * 1000);
                userToUpdate.stripe.cancelAtPeriodEnd = subUpdated.cancel_at_period_end;
                await userToUpdate.save();
            }
            break;
            
        case 'customer.subscription.deleted':
            const subDeleted = event.data.object;
            const userToDowngrade = await User.findOne({ 
                'stripe.subscriptionId': subDeleted.id 
            });
            
            if (userToDowngrade) {
                userToDowngrade.plan = 'free';
                userToDowngrade.stripe.status = 'canceled';
                userToDowngrade.stripe.subscriptionId = null;
                await userToDowngrade.updatePlanLimits();
            }
            break;
    }
    
    res.json({ received: true });
};

const cancelSubscription = async (req, res) => {
    try {
        const user = req.user;
        
        if (!user.stripe.subscriptionId) {
            return res.status(400).json({
                success: false,
                message: 'No active subscription'
            });
        }
        
        // Stripe-da ləğv et (ay sonunda)
        const subscription = await stripe.subscriptions.update(
            user.stripe.subscriptionId,
            { cancel_at_period_end: true }
        );
        
        // User-də qeyd et
        user.stripe.cancelAtPeriodEnd = true;
        await user.save();
        
        res.json({
            success: true,
            message: 'Subscription will be canceled at period end',
            endsAt: subscription.current_period_end
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};


module.exports = { webhookHandler, createCheckoutSession, cancelSubscription };