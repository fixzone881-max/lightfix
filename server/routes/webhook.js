const express = require('express');
const config = require('../config');
const supabase = require('../db/supabaseClient');
const verifyMetaSignature = require('../middleware/verifyMetaSignature');
const { handleIncomingComment, handleIncomingDm } = require('../services/automationEngine');
const { setCommentHidden } = require('../services/instagramApi');

const router = express.Router();

// Meta's one-time verification handshake when you register the webhook URL.
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.meta.verifyToken) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// All real-time events land here.
router.post('/', verifyMetaSignature, async (req, res) => {
  res.sendStatus(200); // ack immediately; Meta retries if you're slow

  try {
    for (const entry of req.body.entry || []) {
      const pageId = entry.id;
      const { data: igAccount } = await supabase
        .from('ig_accounts')
        .select('*')
        .eq('fb_page_id', pageId)
        .maybeSingle();
      if (!igAccount) continue;

      for (const change of entry.changes || []) {
        if (change.field === 'feed' && change.value?.item === 'comment') {
          const value = change.value;
          const result = await handleIncomingComment({
            igAccount,
            commentId: value.comment_id,
            senderIgId: value.from?.id,
            senderUsername: value.from?.name,
            text: value.message,
          });
          if (result.moderated) {
            await setCommentHidden(value.comment_id, igAccount.access_token, true);
          }
        }
      }

      for (const messaging of entry.messaging || []) {
        if (messaging.message?.text) {
          await handleIncomingDm({
            igAccount,
            senderIgId: messaging.sender?.id,
            senderUsername: null,
            text: messaging.message.text,
          });
        }
      }
    }
  } catch (err) {
    console.error('[webhook] processing error:', err.message);
  }
});

module.exports = router;
