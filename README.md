# Signal — Instagram DM automation platform

A from-scratch build of the core mechanics behind tools like LinkPlease:
comment-to-DM automation, DM auto-reply, AI comment moderation, brand-deal
detection, and digital product sales inside Instagram DMs.

This is a **working scaffold**, not a finished, Meta-app-reviewed product.
It gives you a real Express backend, a Postgres schema, and a plain-HTML
dashboard you can run locally today and deploy once you fill in your own
API keys.

## What's included

- **Auth** — email/password signup & login (JWT cookie), plus the full
  Instagram/Facebook OAuth "Connect Instagram" flow.
- **Webhook receiver** — verifies Meta's signature, handles comment and DM
  events in real time.
- **Automation engine** — keyword-based triggers (comment → DM, DM → DM),
  with an optional public reply.
- **AI comment moderation** — keyword rules run first (free, instant);
  falls back to an AI classifier for anything ambiguous, if you add an API
  key. Hides spam/hate/competitor comments automatically.
- **Brand-deal detector** — flags DMs that mention partnerships, collabs,
  or sponsorships so they don't get lost.
- **Rate-limited send queue** — paces outbound DMs and rewrites each one
  with an AI-generated variant so you never send an identical message twice.
- **Digital products** — Stripe Checkout links you can drop into a DM
  automation; a webhook fulfills the sale by DMing the buyer their file.
- **Dashboard** — plain HTML/CSS/JS (no build step) covering overview
  stats, automations, comment feed, brand deals, and products.

## What you still need to do before this is production-ready

1. **Meta app review.** `instagram_manage_messages` and
   `instagram_manage_comments` are restricted permissions — you'll need to
   submit your app for App Review with screencasts of the flow before you
   can use them on accounts you don't own.
2. **A real database.** Create a free Supabase project, then run
   `server/db/schema.sql` in its SQL editor.
3. **Stripe.** Create an account, get your secret key, and register the
   webhook endpoint (`/api/stripe/webhook`) for the
   `checkout.session.completed` event.
4. **An AI key (optional).** Any OpenAI-compatible endpoint works. Without
   one, moderation and deal detection still work via the keyword rules —
   you just lose the AI fallback and message-variant rewriting.

## Local setup

```bash
cd igdm
npm install
cp .env.example .env   # then fill in the values — see comments in the file
npm run dev             # requires nodemon (already in devDependencies)
```

Visit `http://localhost:3000/signup.html` to create your first account,
then click **Connect Instagram** on the dashboard.

## Deploying

This is a stateful Node process (it runs a background queue worker), so it
needs a host that keeps a Node process alive — not static/shared hosting.
Straightforward options:

- **Railway / Render / Fly.io** — push this repo, set the env vars from
  `.env.example` in their dashboard, done.
- **A small VPS (e.g. Hostinger's VPS plans, not shared hosting)** — install
  Node 18+, `npm install`, run with `pm2 start server/index.js` so it
  restarts on crash/reboot, and put Nginx in front for TLS.

Whichever you pick, set `APP_URL` and `META_REDIRECT_URI` to your real
domain, and update the redirect URI in your Meta app settings to match.

## Project layout

```
server/
  index.js              Express app entrypoint + queue worker startup
  config.js              Loads all env vars in one place
  db/
    schema.sql            Postgres schema — run once in Supabase
    supabaseClient.js
  routes/
    auth.js                Signup/login + Instagram OAuth
    webhook.js              Meta webhook verification + event receiver
    automations.js          CRUD for automation rules
    comments.js              Comment/DM event feed
    deals.js                 Brand-deal-flagged DMs
    products.js               Digital products + Stripe checkout links
    stripeWebhook.js           Stripe webhook → fulfillment
    dashboard.js                Logged-in user info + leads
  services/
    instagramApi.js         Graph API wrapper (OAuth, send DM, moderate)
    automationEngine.js      Matches triggers, runs moderation/deal checks
    moderation.js             Keyword + AI comment classification
    dealDetector.js            Brand-deal keyword heuristic
    aiVariant.js                AI message-variant rewriting
    queue.js                    Rate-limited DM send queue
    stripeService.js             Checkout session + fulfillment
  middleware/
    requireAuth.js           JWT session check
    verifyMetaSignature.js    HMAC verification for Meta webhooks
public/
  *.html                   Dashboard pages (no build step, just static files)
  css/style.css
  js/api.js
```
