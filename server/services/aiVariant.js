const axios = require('axios');
const config = require('../config');

/**
 * Produce a natural-sounding variant of a base DM so the same text isn't sent
 * verbatim to everyone (which trips spam filters). Falls back to the original
 * message untouched if no AI key is configured.
 */
async function rewriteVariant(baseMessage) {
  if (!config.ai.apiKey) return baseMessage;

  try {
    const { data } = await axios.post(
      `${config.ai.apiBase}/chat/completions`,
      {
        model: config.ai.model,
        messages: [
          {
            role: 'system',
            content:
              'Rewrite the following DM in a friendly, natural way, keeping the same meaning, links, and length roughly the same. Return only the rewritten message, no quotes or preamble.',
          },
          { role: 'user', content: baseMessage },
        ],
        temperature: 0.8,
        max_tokens: 200,
      },
      { headers: { Authorization: `Bearer ${config.ai.apiKey}` } }
    );
    return data.choices?.[0]?.message?.content?.trim() || baseMessage;
  } catch (err) {
    console.error('[aiVariant] falling back to base message:', err.message);
    return baseMessage;
  }
}

module.exports = { rewriteVariant };
