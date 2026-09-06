const express = require('express');
const supabase = require('../db/supabaseClient');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

// List connected IG accounts for the logged-in user
router.get('/accounts', async (req, res) => {
  const { data, error } = await supabase
    .from('ig_accounts')
    .select('id, username, ig_business_id, connected_at')
    .eq('app_user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// List automations across all of the user's accounts (or one, via ?account_id=)
router.get('/', async (req, res) => {
  const { data: accounts } = await supabase.from('ig_accounts').select('id').eq('app_user_id', req.user.id);
  const accountIds = (accounts || []).map((a) => a.id);
  if (accountIds.length === 0) return res.json([]);

  let query = supabase.from('automations').select('*').in('ig_account_id', accountIds);
  if (req.query.account_id) query = query.eq('ig_account_id', req.query.account_id);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', async (req, res) => {
  const { ig_account_id, name, trigger_type, keywords, require_follow, reply_public_comment, dm_message } = req.body;

  // Confirm the account belongs to this user before writing to it
  const { data: account } = await supabase
    .from('ig_accounts')
    .select('id')
    .eq('id', ig_account_id)
    .eq('app_user_id', req.user.id)
    .maybeSingle();
  if (!account) return res.status(403).json({ error: 'Account not found for this user' });

  const { data, error } = await supabase
    .from('automations')
    .insert({
      ig_account_id,
      name,
      trigger_type,
      keywords: keywords || [],
      require_follow: !!require_follow,
      reply_public_comment: reply_public_comment || null,
      dm_message,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch('/:id', async (req, res) => {
  const updates = (({ name, trigger_type, keywords, require_follow, reply_public_comment, dm_message, active }) => ({
    name,
    trigger_type,
    keywords,
    require_follow,
    reply_public_comment,
    dm_message,
    active,
  }))(req.body);

  const { data, error } = await supabase.from('automations').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('automations').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
