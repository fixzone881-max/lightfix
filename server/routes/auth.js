const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const config = require('../config');
const supabase = require('../db/supabaseClient');
const {
  exchangeCodeForToken,
  getLongLivedToken,
  listPagesWithInstagram,
  subscribePageWebhooks,
} = require('../services/instagramApi');

const router = express.Router();

function issueSessionCookie(res, appUser) {
  const token = jwt.sign({ id: appUser.id, email: appUser.email }, config.jwtSecret, { expiresIn: '30d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
}

// --- Email/password signup & login for the dashboard itself ---

router.post('/signup', async (req, res) => {
  const { email, password, fullName } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const { data: existing } = await supabase.from('app_users').select('id').eq('email', email).maybeSingle();
  if (existing) return res.status(409).json({ error: 'Account already exists' });

  const password_hash = await bcrypt.hash(password, 10);
  const { data: appUser, error } = await supabase
    .from('app_users')
    .insert({ email, password_hash, full_name: fullName || null })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  issueSessionCookie(res, appUser);
  res.json({ id: appUser.id, email: appUser.email });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { data: appUser } = await supabase.from('app_users').select('*').eq('email', email).maybeSingle();
  if (!appUser) return res.status(401).json({ error: 'Invalid email or password' });

  const ok = await bcrypt.compare(password, appUser.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  issueSessionCookie(res, appUser);
  res.json({ id: appUser.id, email: appUser.email });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// --- Instagram / Facebook OAuth connect flow ---

// Step 1: send the creator to Facebook's Login dialog with the right scopes.
router.get('/instagram/start', (req, res) => {
  const scopes = [
    'instagram_basic',
    'instagram_manage_messages',
    'instagram_manage_comments',
    'pages_show_list',
    'pages_manage_metadata',
  ].join(',');

  const url =
    `https://www.facebook.com/${config.meta.graphVersion}/dialog/oauth` +
    `?client_id=${config.meta.appId}` +
    `&redirect_uri=${encodeURIComponent(config.meta.redirectUri)}` +
    `&scope=${scopes}` +
    `&state=${req.user?.id || ''}`;

  res.redirect(url);
});

// Step 2: Facebook redirects back here with a "code".
router.get('/instagram/callback', async (req, res) => {
  const { code, state: appUserId } = req.query;
  if (!code) return res.status(400).send('Missing code');

  try {
    const shortToken = await exchangeCodeForToken(code);
    const longToken = await getLongLivedToken(shortToken);
    const pages = await listPagesWithInstagram(longToken);

    const linked = [];
    for (const page of pages) {
      if (!page.instagram_business_account) continue;
      await subscribePageWebhooks(page.id, page.access_token);

      const { data } = await supabase
        .from('ig_accounts')
        .upsert(
          {
            app_user_id: appUserId,
            ig_business_id: page.instagram_business_account.id,
            fb_page_id: page.id,
            username: page.instagram_business_account.username,
            access_token: page.access_token,
          },
          { onConflict: 'app_user_id,ig_business_id' }
        )
        .select()
        .single();
      linked.push(data);
    }

    res.redirect(`${config.appUrl}/dashboard.html?connected=${linked.length}`);
  } catch (err) {
    console.error('[auth] instagram callback failed:', err.response?.data || err.message);
    res.redirect(`${config.appUrl}/dashboard.html?connect_error=1`);
  }
});

module.exports = router;
