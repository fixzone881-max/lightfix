require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET,

  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

  meta: {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    redirectUri: process.env.META_REDIRECT_URI,
    verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN,
    graphVersion: process.env.META_GRAPH_API_VERSION || 'v20.0',
  },

  ai: {
    apiKey: process.env.AI_API_KEY,
    apiBase: process.env.AI_API_BASE || 'https://api.openai.com/v1',
    model: process.env.AI_MODEL || 'gpt-4o-mini',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
};
