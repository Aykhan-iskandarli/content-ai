// controllers/content.controller.js
const { model } = require('../config/gemini');
const User = require('../models/user');
const { getUserLimits, getAnonymousLimits } = require('../helper/userLimit');

const generateContent = async (req, res) => {
  try {
    const { productName, keyFeatures, targetAudience, tone, contentType } =
      req.body;

    let userLimits = null;
    let isAnonymous = false;

    // User və ya anonim limit check
    if (req.isAuthenticated && req.user) {
      // Login user limits
      userLimits = await getUserLimits(req.user);
    } else {
      // Anonim user limits
      userLimits = getAnonymousLimits(req);
      isAnonymous = true;
    }

    // Limit check (həm user həm anonim üçün)
    if (!userLimits.canGenerate) {
      const reason =
        userLimits.generationsUsed >= userLimits.generationsLimit
          ? 'Generation limit reached'
          : userLimits.dailyTokensRemaining <= 0
          ? 'Daily token limit reached'
          : 'Monthly token limit reached';

      const message = isAnonymous
        ? `Anonymous ${reason}. Sign up for higher limits!`
        : `${reason}. Upgrade to premium!`;

      return res.status(429).json({
        success: false,
        message: message,
        limits: {
          generations: `${userLimits.generationsUsed}/${userLimits.generationsLimit} used`,
          generationsRemaining: userLimits.generationsRemaining,
          dailyGenerationsRemaining:
            userLimits.dailyGenerationsRemaining || null,
          dailyTokens: `${userLimits.dailyTokensRemaining} tokens remaining today`,
          monthlyTokens: `${userLimits.monthlyTokensRemaining} tokens remaining this month`,
        },
        upgradeMessage: isAnonymous
          ? 'Sign up for 10 free generations per month!'
          : 'Upgrade to premium for unlimited access!',
      });
    }

    // Azerbaijan-focused prompt
    const promptTemplate = `
Sen Azərbaycan bazarında ixtisaslaşmış peşəkar marketinq yazıçısı və SEO mütəxəsisisən.
Vəzifən YALNIZ AZƏRBAYCAN DİLİNDƏ yaradıcı məzmun yaratmaqdır.

--- PARAMETRLƏR ---
1. Məhsul: ${productName}
2. Xüsusiyyətlər: ${keyFeatures.join(', ')}
3. Hədəf Kütlə: ${targetAudience}
4. Ton: ${tone}
5. Növ: ${contentType}
---

${
  contentType === 'Instagram Caption'
    ? `
- MAKSİMUM 5 sətir
- Emojilər istifadə et
- 5 Azərbaycan hashtag əlavə et (#baku #azerbaijan)
- "Link bio-da!" ilə bitir
`
    : ''
}

${
  contentType === 'E-commerce Product Description'
    ? `
- 3 abzas yaz
- "Səbətə Əlavə Et!" ilə bitir
- SEO açar sözləri daxil et
`
    : ''
}

MÜTLƏQ Azərbaycan dilində və mədəniyyətinə uyğun yaz.`;

    // API call
    const startTime = Date.now();
    const result = await model.generateContent(promptTemplate);
    const generatedText = result.response.text();
    const responseTime = Date.now() - startTime;

    // Token usage
    const usage = result.response.usageMetadata;
    const tokenCount = {
      inputTokens: usage?.promptTokenCount || 0,
      outputTokens: usage?.candidatesTokenCount || 0,
      totalTokens: usage?.totalTokenCount || 0,
    };

    // Update user if logged in
    if (req.isAuthenticated && req.user) {
      const user = req.user;
      user.monthlyGenerationCount++;
      user.tokenUsage.daily.count += tokenCount.totalTokens;
      user.tokenUsage.monthly.count += tokenCount.totalTokens;
      user.tokenUsage.total += tokenCount.totalTokens;
      await user.save();

      // Save to history
      await ContentGeneration.create({
        userId: user._id,
        input: { productName, keyFeatures, targetAudience, tone, contentType },
        generatedContent: generatedText,
        tokens: tokenCount,
        apiResponse: {
          model: 'gemini-2.5-flash',
          responseTime,
          finishReason: result.response.candidates?.[0]?.finishReason,
        },
      });
    } else {
      console.log(req.session, "req.session");
      req.session.anonymousUsage.dailyCount++;
      req.session.anonymousUsage.monthlyCount++;
      req.session.anonymousUsage.dailyTokens += tokenCount.totalTokens;
      req.session.anonymousUsage.monthlyTokens += tokenCount.totalTokens;
    }

    // Response
   res.json({
            success: true,
            data: {
                generatedContent: generatedText,
                parameters: { productName, contentType, tone }
            },
            usage: {
                tokensUsed: tokenCount.totalTokens,
                limits: {
                    generations: `${userLimits.generationsUsed + 1}/${userLimits.generationsLimit}`,
                    generationsRemaining: userLimits.generationsRemaining - 1,
                    dailyTokensRemaining: userLimits.dailyTokensRemaining - tokenCount.totalTokens,
                    monthlyTokensRemaining: userLimits.monthlyTokensRemaining - tokenCount.totalTokens,
                    percentageUsed: Math.round(
                        ((userLimits.generationsUsed + 1) / userLimits.generationsLimit) * 100
                    ),
                },
                accountType: isAnonymous ? 'anonymous' : 'registered',
                message: isAnonymous 
                    ? 'Sign up to get higher limits!'
                    : `You are on ${req.user.plan} plan`
            }
        });
  } catch (error) {
    console.error('Content generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate content',
      error: error.message,
    });
  }
};

// API status - həm anonim həm user üçün
const getApiStatus = async (req, res) => {
  try {
    let response = {
      success: true,
      apiLimits: {
        gemini: {
          daily: '1,000,000 tokens (Gemini API total)',
          monthly: '1,500,000 tokens (Gemini API total)',
          rpm: '60 requests per minute'
        }
      }
    };

    // User və ya anonim status
    if (req.isAuthenticated && req.user) {
      // Login user limits
      const userLimits = await getUserLimits(req.user);
      
      response.userStatus = {
        isLoggedIn: true,
        accountType: 'registered',
        plan: req.user.plan,
        limits: {
          dailyTokens: 32000,
          monthlyTokens: 1000000,
          dailyGenerations: 'Unlimited',
          monthlyGenerations: 10
        },
        usage: {
          generationsToday: `${userLimits.generationsUsed}/${userLimits.generationsLimit}`,
          generationsRemaining: userLimits.generationsRemaining,
          dailyTokensRemaining: userLimits.dailyTokensRemaining,
          monthlyTokensRemaining: userLimits.monthlyTokensRemaining,
          percentageUsed: {
            daily: Math.round((1 - userLimits.dailyTokensRemaining / 32000) * 100),
            monthly: Math.round((1 - userLimits.monthlyTokensRemaining / 1000000) * 100),
            generations: Math.round((userLimits.generationsUsed / userLimits.generationsLimit) * 100)
          }
        }
      };
    } else {
      // Anonim user limits
      const anonLimits = getAnonymousLimits(req);
      
      response.userStatus = {
        isLoggedIn: false,
        accountType: 'anonymous',
        limits: {
          dailyTokens: 10000,
          monthlyTokens: 100000,
          dailyGenerations: 3,
          monthlyGenerations: 20
        },
        usage: {
          generationsToday: `${anonLimits.generationsUsed}/${anonLimits.generationsLimit}`,
          generationsRemaining: anonLimits.generationsRemaining,
          dailyGenerationsRemaining: anonLimits.dailyGenerationsRemaining,
          dailyTokensRemaining: anonLimits.dailyTokensRemaining,
          monthlyTokensRemaining: anonLimits.monthlyTokensRemaining,
          percentageUsed: {
            daily: Math.round((1 - anonLimits.dailyTokensRemaining / 10000) * 100),
            monthly: Math.round((1 - anonLimits.monthlyTokensRemaining / 100000) * 100),
            generations: Math.round((anonLimits.generationsUsed / anonLimits.generationsLimit) * 100)
          }
        },
        message: 'You are using anonymous limits. Sign up for higher limits!',
        comparison: {
          anonymous: '3 generations/day, 20/month',
          free: '10 generations/month, more tokens',
          premium: 'Unlimited generations'
        }
      };
    }

    // API health status
    response.apiHealth = {
      status: 'operational',
      responseTime: 'fast',
      lastChecked: new Date().toISOString()
    };

    res.json(response);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get API status',
      error: error.message
    });
  }
};

module.exports = {
  generateContent,
  getApiStatus
};
