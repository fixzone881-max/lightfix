const express = require('express');
const supabase = require('../db/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const { getSubscribedApps } = require('../services/instagramApi');

const router = express.Router();
router.use(requireAuth);

router.get('/me', async (req, res) => {
  const { data } = await supabase.from('app_users').select('id, email, full_name, plan').eq('id', req.user.id).single();
  res.json(data);
});

router.get('/leads', async (req, res) => {
  const { data: accounts } = await supabase.from('ig_accounts').select('id').eq('app_user_id', req.user.id);
  const accountIds = (accounts || []).map((a) => a.id);
  if (accountIds.length === 0) return res.json([]);
  const { data, error } = await supabase.from('leads').select('*').in('ig_account_id', accountIds).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/debug-instagram', async (req, res) => {
  const { data: accounts, error } = await supabase.from('ig_accounts').select('id, ig_business_id, username, access_token').eq('app_user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  if (!accounts || accounts.length === 0) return res.json({ message: 'No connected accounts found' });

  const results = [];
  for (const acc of accounts) {
    try {
      const sub = await getSubscribedApps(acc.ig_business_id, acc.access_token);
      results.push({ username: acc.username, ig_business_id: acc.ig_business_id, subscribed_apps: sub });
    } catch (err) {
      results.push({ username: acc.username, ig_business_id: acc.ig_business_id, error: err.response?.data || err.message });
    }
  }
  res.json(results);
});

module.exports = router;