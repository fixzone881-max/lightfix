const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const supabase = require('../db/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const { exchangeCodeForToken, getLongLivedToken, getMyProfile, subscribeAccountWebhooks } = require('../services/instagramApi');

const router = express.Router();

function issueSessionCookie(res, appUser) {
  const token = jwt.sign({ id: appUser.id, email: appUser.email }, config.jwtSecret, { expiresIn: '30d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
}

router.post('/signup', async (req, res) => {
  const { email, password, fullName } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const { data: existing } = await supabase.from('app_users').select('id').eq('email', email).maybeSingle();
  if (existing) return res.status(409).json({ error: 'Account already exists' });
  const password_hash = await bcrypt.hash(password, 10);
  const { data: appUser, error } = await supabase.from('app_users').insert({ email, password_hash, full_name: fullName || null }).select().single();
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

router.post('/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

router.get('/instagram/start', requireAuth, (req, res) => {
  const scopes = ['instagram_business_basic', 'instagram_business_manage_messages', 'instagram_business_manage_comments'].join(',');
  const url = `https://www.instagram.com/oauth/authorize?client_id=${config.meta.appId}&redirect_uri=${encodeURIComponent(config.meta.redirectUri)}&scope=${scopes}&response_type=code&state=${req.user.id}`;
  res.redirect(url);
});

router.get('/instagram/callback', async (req, res) => {
  const { code, state: appUserId } = req.query;
  if (!code) return res.status(400).send('Missing code');
  if (!appUserId) {
    console.error('[auth] instagram callback: missing state/appUserId — was /instagram/start reached without being logged in?');
    return res.redirect(`${config.appUrl}/dashboard.html?connect_error=1`);
  }

  try {
    const shortLived = await exchangeCodeForToken(code);
    const longToken = await getLongLivedToken(shortLived.access_token);
    const profile = await getMyProfile(longToken);
    await subscribeAccountWebhooks(profile.user_id, longToken);

    const { error: upsertError } = await supabase.from('ig_accounts').upsert(
      { app_user_id: appUserId, ig_business_id: String(profile.user_id), fb_page_id: null, username: profile.username, access_token: longToken },
      { onConflict: 'app_user_id,ig_business_id' }
    );
    if (upsertError) throw upsertError;

    res.redirect(`${config.appUrl}/dashboard.html?connected=1`);
  } catch (err) {
    console.error('[auth] instagram callback failed:', err.response?.data || err.message || err);
    res.redirect(`${config.appUrl}/dashboard.html?connect_error=1`);
  }
});

module.exports = router;