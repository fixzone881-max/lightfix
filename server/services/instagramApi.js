const axios = require('axios');
const config = require('../config');

const GRAPH = `https://graph.facebook.com/${config.meta.graphVersion}`;

/**
 * Exchange the OAuth "code" from the Facebook Login dialog for a short-lived
 * user access token, then upgrade it to a long-lived one.
 */
async function exchangeCodeForToken(code) {
  const { data } = await axios.get(`${GRAPH}/oauth/access_token`, {
    params: {
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      redirect_uri: config.meta.redirectUri,
      code,
    },
  });
  return data.access_token; // short-lived
}

async function getLongLivedToken(shortLivedToken) {
  const { data } = await axios.get(`${GRAPH}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      fb_exchange_token: shortLivedToken,
    },
  });
  return data.access_token; // ~60 day token
}

/** List the Facebook Pages this user manages, with their linked IG business account. */
async function listPagesWithInstagram(userAccessToken) {
  const { data } = await axios.get(`${GRAPH}/me/accounts`, {
    params: {
      access_token: userAccessToken,
      fields: 'id,name,access_token,instagram_business_account{id,username}',
    },
  });
  return data.data || [];
}

/** Send a DM to a user who has messaged/commented recently (24h messaging window applies). */
async function sendDirectMessage(igBusinessId, pageAccessToken, recipientIgId, text) {
  const url = `${GRAPH}/${igBusinessId}/messages`;
  const { data } = await axios.post(
    url,
    { recipient: { id: recipientIgId }, message: { text } },
    { params: { access_token: pageAccessToken } }
  );
  return data;
}

/** Reply publicly to a comment. */
async function replyToComment(commentId, pageAccessToken, message) {
  const url = `${GRAPH}/${commentId}/replies`;
  const { data } = await axios.post(url, null, {
    params: { access_token: pageAccessToken, message },
  });
  return data;
}

/** Hide (or unhide) a comment — used by the moderation engine. */
async function setCommentHidden(commentId, pageAccessToken, hide = true) {
  const url = `${GRAPH}/${commentId}`;
  const { data } = await axios.post(url, null, {
    params: { access_token: pageAccessToken, is_hidden: hide },
  });
  return data;
}

/** Subscribe a Page to the webhook fields we care about. */
async function subscribePageWebhooks(pageId, pageAccessToken) {
  const url = `${GRAPH}/${pageId}/subscribed_apps`;
  const { data } = await axios.post(url, null, {
    params: {
      access_token: pageAccessToken,
      subscribed_fields: 'feed,messages,comments,mentions,message_reactions',
    },
  });
  return data;
}

module.exports = {
  exchangeCodeForToken,
  getLongLivedToken,
  listPagesWithInstagram,
  sendDirectMessage,
  replyToComment,
  setCommentHidden,
  subscribePageWebhooks,
};
