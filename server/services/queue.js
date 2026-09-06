const supabase = require('../db/supabaseClient');
const { sendDirectMessage } = require('./instagramApi');
const { rewriteVariant } = require('./aiVariant');

// Conservative pace: stay well under Meta's per-account send limits and spread
// out during viral spikes instead of bursting.
const SEND_INTERVAL_MS = 2000; // one send every 2s per process
const MAX_ATTEMPTS = 3;

let running = false;

async function enqueueDm(igAccountId, recipientIgId, message, scheduledFor = new Date()) {
  const { error } = await supabase.from('dm_queue').insert({
    ig_account_id: igAccountId,
    recipient_ig_id: recipientIgId,
    message,
    scheduled_for: scheduledFor.toISOString(),
  });
  if (error) throw error;
}

async function processNext(getAccountToken) {
  const { data: rows, error } = await supabase
    .from('dm_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(1);

  if (error || !rows || rows.length === 0) return;
  const job = rows[0];

  try {
    const account = await getAccountToken(job.ig_account_id);
    if (!account) throw new Error('No token for account');

    const variant = await rewriteVariant(job.message); // AI message rotation
    await sendDirectMessage(account.ig_business_id, account.access_token, job.recipient_ig_id, variant);

    await supabase
      .from('dm_queue')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', job.id);
  } catch (err) {
    const attempts = job.attempts + 1;
    await supabase
      .from('dm_queue')
      .update({
        attempts,
        status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        scheduled_for: new Date(Date.now() + attempts * 30000).toISOString(), // back off
      })
      .eq('id', job.id);
    console.error('[queue] send failed:', err.message);
  }
}

/** Start the background worker loop. Call once when the server boots. */
function startQueueWorker(getAccountToken) {
  if (running) return;
  running = true;
  setInterval(() => processNext(getAccountToken), SEND_INTERVAL_MS);
  console.log('[queue] DM worker started');
}

module.exports = { enqueueDm, startQueueWorker };
