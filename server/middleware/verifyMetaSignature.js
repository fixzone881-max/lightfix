const crypto = require('crypto');
const config = require('../config');

/**
 * Verifies the X-Hub-Signature-256 header Meta sends on every webhook POST.
 * Requires the raw request body — mounted with express.json({ verify: ... })
 * in index.js, which stashes the raw buffer on req.rawBody.
 */
module.exports = function verifyMetaSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature || !req.rawBody) return res.status(401).send('Missing signature');

  const expected =
    'sha256=' + crypto.createHmac('sha256', config.meta.appSecret).update(req.rawBody).digest('hex');

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).send('Invalid signature');
  }
  next();
};
