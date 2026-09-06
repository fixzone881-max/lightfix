const express = require('express');
const supabase = require('../db/supabaseClient');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

// Recent comment/DM events for this user's accounts, newest first.
router.get('/', async (req, res) => {
  const { data: accounts } = await supabase.from('ig_accounts').select('id').eq('app_user_id', req.user.id);
  const accountIds = (accounts || []).map((a) => a.id);
  if (accountIds.length === 0) return res.json([]);

  const { data, error } = await supabase
    .from('events_log')
    .select('*')
    .in('ig_account_id', accountIds)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
