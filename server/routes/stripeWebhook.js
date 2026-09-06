const express = require('express');
const config = require('../config');
const { stripe, handleCheckoutCompleted } = require('../services/stripeService');

const router = express.Router();

// NOTE: mounted with express.raw() in index.js — Stripe signature verification
// needs the untouched raw body, not JSON-parsed.
router.post('/', async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.stripe.webhookSecret);
  } catch (err) {
    console.error('[stripe webhook] signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    await handleCheckoutCompleted(event.data.object);
  }

  res.json({ received: true });
});

module.exports = router;
