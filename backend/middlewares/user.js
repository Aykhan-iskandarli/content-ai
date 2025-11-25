// middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/user');

// Required auth - token mütləq lazımdır
const requireAuth = async (req, res, next) => {
    try {
        // Token-i header-dən al
        const authHeader = req.header('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }
        
        // Bearer prefix-ini sil
        const token = authHeader.replace('Bearer ', '');
        
        // Token-i verify et
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // User-i tap
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // User active-dirmi?
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated'
            });
        }
        
        // Request-ə user məlumatını əlavə et
        req.userId = user._id;
        req.user = user;
        
        next();
        
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Authentication error',
            error: error.message
        });
    }
};

const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');

        // FUNKSİYA: Anonim istifadə üçün ilkin dəyərləri təmin edir
        const initializeAnonymousSession = () => {
            req.user = null;
            req.userId = null;
            req.isAuthenticated = false;
            
            // *** Əsas Düzəliş Buradadır ***
            // req.session mövcuddursa və anonimUsage obyekti yoxdursa, onu yaradırıq.
            if (req.session && !req.session.anonymousUsage) {
                req.session.anonymousUsage = {
                    dailyCount: 0,
                    monthlyCount: 0,
                    dailyTokens: 0,
                    monthlyTokens: 0,
                };
            }
        };

        // --- 1. Token yoxdursa və ya Bearer deyil
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            initializeAnonymousSession();
            return next(); // Anonim kimi davam et
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (user && user.isActive) {
            req.user = user;
            req.userId = user._id;
            req.isAuthenticated = true;
    
        } else {
            initializeAnonymousSession();
        }

        next();

    } catch (error) {
        initializeAnonymousSession();
        next(); // Anonim kimi davam et
    }
};

module.exports = { requireAuth, optionalAuth  };