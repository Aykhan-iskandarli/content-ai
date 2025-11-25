// Helper function - user limits hesabla
const getUserLimits = async (user) => {
  if (!user) return null;

  // Reset check
  user.checkMonthlyReset();
  user.checkDailyReset();

  const tokenStatus = user.hasTokensRemaining();

  return {
    canGenerate: tokenStatus.canGenerate,
    dailyTokensRemaining: tokenStatus.dailyRemaining,
    monthlyTokensRemaining: tokenStatus.monthlyRemaining,
    generationsUsed: user.monthlyGenerationCount,
    generationsLimit: user.limits.monthlyGenerations,
    generationsRemaining:
      user.limits.monthlyGenerations - user.monthlyGenerationCount,
  };
};

const getAnonymousLimits = (req) => {
  // Session və ya IP əsaslı tracking
  if (!req.session.anonymousUsage) {
    req.session.anonymousUsage = {
      dailyCount: 0,
      monthlyCount: 0,
      lastReset: new Date(),
      dailyTokens: 0,
      monthlyTokens: 0,
    };
  }

  const usage = req.session.anonymousUsage;
  const now = new Date();

  // Daily reset check
  const lastReset = new Date(usage.lastReset);
  if (
    now.getDate() !== lastReset.getDate() ||
    now.getMonth() !== lastReset.getMonth()
  ) {
    usage.dailyCount = 0;
    usage.dailyTokens = 0;
    usage.lastReset = now;
  }

  // Monthly reset check
  if (
    now.getMonth() !== lastReset.getMonth() ||
    now.getFullYear() !== lastReset.getFullYear()
  ) {
    usage.monthlyCount = 0;
    usage.monthlyTokens = 0;
  }

  // Anonim limits (çox aşağı)
  const limits = {
    dailyGenerations: 3, // Gündə 3 generation
    monthlyGenerations: 20, // Ayda 20 generation
    dailyTokens: 10000, // 10K token (login: 32K)
    monthlyTokens: 100000, // 100K token (login: 1M)
  };

  return {
    canGenerate:
      usage.dailyCount < limits.dailyGenerations &&
      usage.monthlyCount < limits.monthlyGenerations &&
      usage.dailyTokens < limits.dailyTokens &&
      usage.monthlyTokens < limits.monthlyTokens,
    generationsUsed: usage.dailyCount,
    generationsLimit: limits.dailyGenerations,
    generationsRemaining: limits.dailyGenerations - usage.dailyCount,
    dailyGenerationsRemaining: limits.dailyGenerations - usage.dailyCount,
    dailyTokensRemaining: limits.dailyTokens - usage.dailyTokens,
    monthlyTokensRemaining: limits.monthlyTokens - usage.monthlyTokens,
    isAnonymous: true,
  };
};

module.exports = { getUserLimits, getAnonymousLimits };
