// server.js
const express = require('express');
const session = require('express-session');
const connectDB = require('./config/database.js');

require('dotenv').config();

const geminiRoutes = require('./routes/content.js');
const authRoutes = require('./routes/user');
const paymentRoutes = require('./routes/stripe');
const { webhookHandler } = require('./controllers/stripe.js');

const app = express();
const PORT = process.env.PORT || 5000;



app.post(
    '/api/payment/stripe-webhook', 
    express.raw({ type: 'application/json' }), // Xüsusi Raw Body Parser
    webhookHandler // Controller funksiyası
);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false, // production-da true
      maxAge: 24 * 60 * 60 * 1000, // 24 saat
    },
  })
);

// Routes
app.use('/api/gemini', geminiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);

// Server başlat
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`✅ Server ${PORT} is work this port`);
      console.log(`📍 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server is not connected', error);
    process.exit(1);
  }
};

startServer();
