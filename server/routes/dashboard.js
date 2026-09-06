const express = require('express');
const supabase = require('../db/supabaseClient');
const requireAuth = require('../middleware/requireAuth');

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

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .in('ig_account_id', accountIds)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
