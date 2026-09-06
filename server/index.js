const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config');
const supabase = require('./db/supabaseClient');
const { startQueueWorker } = require('./services/queue');

const authRoutes = require('./routes/auth');
const webhookRoutes = require('./routes/webhook');
const automationsRoutes = require('./routes/automations');
const commentsRoutes = require('./routes/comments');
const dealsRoutes = require('./routes/deals');
const productsRoutes = require('./routes/products');
const dashboardRoutes = require('./routes/dashboard');
const stripeWebhookRoutes = require('./routes/stripeWebhook');

const app = express();

app.use(cors({ origin: config.appUrl, credentials: true }));
app.use(cookieParser());

// Stripe webhook needs the raw body for signature verification — mount BEFORE express.json().
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookRoutes);

// Meta webhook also needs the raw body (for X-Hub-Signature-256), stashed alongside the parsed JSON.
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/automations', automationsRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => res.json({ ok: true }));

// Looks up the access token + IG business id for a connected account (used by the DM queue worker).
async function getAccountToken(igAccountId) {
  const { data } = await supabase
    .from('ig_accounts')
    .select('ig_business_id, access_token')
    .eq('id', igAccountId)
    .single();
  return data;
}

app.listen(config.port, () => {
  console.log(`igdm-automation listening on http://localhost:${config.port}`);
  startQueueWorker(getAccountToken);
});
