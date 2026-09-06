const supabase = require('../db/supabaseClient');
const { replyToComment } = require('./instagramApi');
const { classifyComment } = require('./moderation');
const { looksLikeBrandDeal } = require('./dealDetector');
const { enqueueDm } = require('./queue');

function textMatchesKeywords(text, keywords) {
  if (!keywords || keywords.length === 0) return true; // empty list = match anything
  const lower = (text || '').toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}

/** Handle an inbound comment: moderate first, then check automations for a comment_keyword match. */
async function handleIncomingComment({ igAccount, commentId, senderIgId, senderUsername, text }) {
  const moderation = await classifyComment(text);
  if (moderation.action) {
    await supabase.from('events_log').insert({
      ig_account_id: igAccount.id,
      event_type: 'comment',
      sender_ig_id: senderIgId,
      sender_username: senderUsername,
      content: text,
      moderation_action: moderation.action,
    });
    // Caller is responsible for actually hiding the comment via instagramApi.setCommentHidden
    return { moderated: true, action: moderation.action };
  }

  const { data: automations } = await supabase
    .from('automations')
    .select('*')
    .eq('ig_account_id', igAccount.id)
    .eq('trigger_type', 'comment_keyword')
    .eq('active', true);

  const matched = (automations || []).find((a) => textMatchesKeywords(text, a.keywords));

  await supabase.from('events_log').insert({
    ig_account_id: igAccount.id,
    automation_id: matched ? matched.id : null,
    event_type: 'comment',
    sender_ig_id: senderIgId,
    sender_username: senderUsername,
    content: text,
    matched: !!matched,
  });

  if (matched) {
    if (matched.reply_public_comment) {
      await replyToComment(commentId, igAccount.access_token, matched.reply_public_comment);
    }
    await enqueueDm(igAccount.id, senderIgId, matched.dm_message);
    return { moderated: false, matched: true, automationId: matched.id };
  }

  return { moderated: false, matched: false };
}

/** Handle an inbound DM: check dm_keyword automations, flag brand deals. */
async function handleIncomingDm({ igAccount, senderIgId, senderUsername, text }) {
  const isDeal = looksLikeBrandDeal(text);

  const { data: automations } = await supabase
    .from('automations')
    .select('*')
    .eq('ig_account_id', igAccount.id)
    .eq('trigger_type', 'dm_keyword')
    .eq('active', true);

  const matched = (automations || []).find((a) => textMatchesKeywords(text, a.keywords));

  await supabase.from('events_log').insert({
    ig_account_id: igAccount.id,
    automation_id: matched ? matched.id : null,
    event_type: 'dm',
    sender_ig_id: senderIgId,
    sender_username: senderUsername,
    content: text,
    matched: !!matched,
    is_brand_deal: isDeal,
  });

  if (matched) {
    await enqueueDm(igAccount.id, senderIgId, matched.dm_message);
  }

  return { matched: !!matched, isDeal };
}

module.exports = { handleIncomingComment, handleIncomingDm, textMatchesKeywords };
