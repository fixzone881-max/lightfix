const Stripe = require('stripe');
const config = require('../config');
const supabase = require('../db/supabaseClient');
const { enqueueDm } = require('./queue');

const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;

/** Create a one-off Checkout Session for a product, to be linked in a DM. */
async function createCheckoutSession(product, buyerIgId) {
  if (!stripe) throw new Error('Stripe not configured');

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: product.currency,
          product_data: { name: product.title, description: product.description || undefined },
          unit_amount: product.price_cents,
        },
        quantity: 1,
      },
    ],
    metadata: { product_id: product.id, buyer_ig_id: buyerIgId || '' },
    success_url: `${config.appUrl}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.appUrl}/checkout-cancelled`,
  });

  return session;
}

/** Handle the Stripe webhook: record the sale and DM the buyer their file. */
async function handleCheckoutCompleted(session) {
  const productId = session.metadata?.product_id;
  const buyerIgId = session.metadata?.buyer_ig_id;
  if (!productId) return;

  const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
  if (!product) return;

  await supabase.from('product_sales').insert({
    product_id: productId,
    buyer_ig_id: buyerIgId || null,
    buyer_email: session.customer_details?.email || null,
    amount_cents: session.amount_total,
    stripe_session_id: session.id,
    fulfilled: !!buyerIgId,
  });

  if (buyerIgId) {
    await enqueueDm(
      product.ig_account_id,
      buyerIgId,
      `Thank you for your purchase! Here's your download: ${product.file_url}`
    );
  }
}

module.exports = { stripe, createCheckoutSession, handleCheckoutCompleted };
