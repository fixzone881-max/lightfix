const express = require('express');
const config = require('../config');
const supabase = require('../db/supabaseClient');
const verifyMetaSignature = require('../middleware/verifyMetaSignature');
const { handleIncomingComment, handleIncomingDm } = require('../services/automationEngine');
const { setCommentHidden } = require('../services/instagramApi');

const router = express.Router();

router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === config.meta.verifyToken) return res.status(200).send(challenge);
  res.sendStatus(403);
});

router.post('/', verifyMetaSignature, async (req, res) => {
  res.sendStatus(200);
  console.log('[webhook] RAW PAYLOAD:', JSON.stringify(req.body));
  try {
    for (const entry of req.body.entry || []) {
      const igBusinessId = entry.id;
      console.log('[webhook] looking up account for ig_business_id =', igBusinessId);
      const { data: igAccount, error: lookupErr } = await supabase.from('ig_accounts').select('*').eq('ig_business_id', String(igBusinessId)).maybeSingle();
      if (lookupErr) console.log('[webhook] lookup error:', lookupErr.message);
      if (!igAccount) { console.log('[webhook] NO MATCHING ACCOUNT FOUND for', igBusinessId); continue; }
      console.log('[webhook] matched account:', igAccount.username);
      for (const change of entry.changes || []) {
        if (change.field === 'comments') {
          const value = change.value;
          const result = await handleIncomingComment({ igAccount, commentId: value.id, senderIgId: value.from?.id, senderUsername: value.from?.username, text: value.text });
          console.log('[webhook] comment handling result:', JSON.stringify(result));
          if (result.moderated) await setCommentHidden(value.id, igAccount.access_token, true);
        }
      }
      for (const messaging of entry.messaging || []) {
        if (messaging.message?.text) {
          await handleIncomingDm({ igAccount, senderIgId: messaging.sender?.id, senderUsername: null, text: messaging.message.text });
        }
      }
    }
  } catch (err) {
    console.error('[webhook] processing error:', err.message);
  }
});

module.exports = router;