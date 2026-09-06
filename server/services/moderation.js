const axios = require('axios');
const config = require('../config');

const SPAM_PATTERNS = [/\bfollow (me|4 follow)\b/i, /\bcheck my (bio|profile)\b/i, /\bDM me\b/i, /(http|www\.)\S+/i];
const HATE_PATTERNS = [/\bf+u+c+k+\s*you\b/i, /\bkill yourself\b/i, /\bidiot\b/i, /\bstupid\b/i];

/**
 * Classify a comment as clean / spam / hate / competitor-promo.
 * Uses simple keyword rules first (fast, free, no API needed), then falls
 * back to an AI classifier for anything ambiguous if a key is configured.
 */
async function classifyComment(text, competitorHandles = []) {
  if (!text) return { action: null, reason: null };

  if (HATE_PATTERNS.some((re) => re.test(text))) return { action: 'hidden_hate', reason: 'hate/harassment pattern' };
  if (SPAM_PATTERNS.some((re) => re.test(text))) return { action: 'hidden_spam', reason: 'spam pattern' };
  if (competitorHandles.some((h) => text.toLowerCase().includes(h.toLowerCase()))) {
    return { action: 'hidden_competitor', reason: 'competitor mention' };
  }

  if (!config.ai.apiKey) return { action: null, reason: null };

  try {
    const { data } = await axios.post(
      `${config.ai.apiBase}/chat/completions`,
      {
        model: config.ai.model,
        messages: [
          {
            role: 'system',
            content:
              'Classify the Instagram comment as one of: clean, spam, hate, competitor_promo. Reply with only that single word.',
          },
          { role: 'user', content: text },
        ],
        temperature: 0,
        max_tokens: 5,
      },
      { headers: { Authorization: `Bearer ${config.ai.apiKey}` } }
    );
    const label = (data.choices?.[0]?.message?.content || 'clean').trim().toLowerCase();
    const map = { spam: 'hidden_spam', hate: 'hidden_hate', competitor_promo: 'hidden_competitor' };
    return { action: map[label] || null, reason: label };
  } catch (err) {
    console.error('[moderation] AI classify failed:', err.message);
    return { action: null, reason: null };
  }
}

module.exports = { classifyComment };
