const express = require('express');
const supabase = require('../db/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const { createCheckoutSession } = require('../services/stripeService');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { data: accounts } = await supabase.from('ig_accounts').select('id').eq('app_user_id', req.user.id);
  const accountIds = (accounts || []).map((a) => a.id);
  if (accountIds.length === 0) return res.json([]);

  const { data, error } = await supabase.from('products').select('*').in('ig_account_id', accountIds);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', async (req, res) => {
  const { ig_account_id, title, description, price_cents, currency, file_url } = req.body;

  const { data: account } = await supabase
    .from('ig_accounts')
    .select('id')
    .eq('id', ig_account_id)
    .eq('app_user_id', req.user.id)
    .maybeSingle();
  if (!account) return res.status(403).json({ error: 'Account not found for this user' });

  const { data, error } = await supabase
    .from('products')
    .insert({ ig_account_id, title, description, price_cents, currency: currency || 'usd', file_url })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Generate a Stripe Checkout link to drop into a DM automation's message text.
router.post('/:id/checkout-link', async (req, res) => {
  const { buyer_ig_id } = req.body;
  const { data: product } = await supabase.from('products').select('*').eq('id', req.params.id).single();
  if (!product) return res.status(404).json({ error: 'Product not found' });

  try {
    const session = await createCheckoutSession(product, buyer_ig_id);
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sales/summary', async (req, res) => {
  const { data: accounts } = await supabase.from('ig_accounts').select('id').eq('app_user_id', req.user.id);
  const accountIds = (accounts || []).map((a) => a.id);
  const { data: products } = await supabase.from('products').select('id').in('ig_account_id', accountIds);
  const productIds = (products || []).map((p) => p.id);
  if (productIds.length === 0) return res.json({ totalSales: 0, totalRevenueCents: 0 });

  const { data: sales } = await supabase.from('product_sales').select('amount_cents').in('product_id', productIds);
  const totalRevenueCents = (sales || []).reduce((sum, s) => sum + s.amount_cents, 0);
  res.json({ totalSales: (sales || []).length, totalRevenueCents });
});

module.exports = router;
