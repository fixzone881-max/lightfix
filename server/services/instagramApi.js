const axios = require('axios');
const config = require('../config');

const GRAPH = `https://graph.instagram.com/${config.meta.graphVersion}`;

async function exchangeCodeForToken(code) {
  const params = new URLSearchParams();
  params.append('client_id', config.meta.appId);
  params.append('client_secret', config.meta.appSecret);
  params.append('grant_type', 'authorization_code');
  params.append('redirect_uri', config.meta.redirectUri);
  params.append('code', code);
  const { data } = await axios.post('https://api.instagram.com/oauth/access_token', params);
  return data;
}

async function getLongLivedToken(shortLivedToken) {
  const { data } = await axios.get('https://graph.instagram.com/access_token', {
    params: { grant_type: 'ig_exchange_token', client_secret: config.meta.appSecret, access_token: shortLivedToken },
  });
  return data.access_token;
}

async function getMyProfile(accessToken) {
  const { data } = await axios.get(`${GRAPH}/me`, {
    params: { fields: 'user_id,username,name', access_token: accessToken },
  });
  return data;
}

async function sendDirectMessage(igBusinessId, accessToken, recipientIgId, text) {
  const { data } = await axios.post(
    `${GRAPH}/${igBusinessId}/messages`,
    { recipient: { id: recipientIgId }, message: { text } },
    { params: { access_token: accessToken } }
  );
  return data;
}

async function replyToComment(commentId, accessToken, message) {
  const { data } = await axios.post(`${GRAPH}/${commentId}/replies`, null, {
    params: { access_token: accessToken, message },
  });
  return data;
}

async function setCommentHidden(commentId, accessToken, hide = true) {
  const { data } = await axios.post(`${GRAPH}/${commentId}`, null, {
    params: { access_token: accessToken, is_hidden: hide },
  });
  return data;
}

async function subscribeAccountWebhooks(igBusinessId, accessToken) {
  const { data } = await axios.post(`${GRAPH}/${igBusinessId}/subscribed_apps`, null, {
    params: { access_token: accessToken, subscribed_fields: 'messages,comments,mentions' },
  });
  return data;
}

async function getSubscribedApps(igBusinessId, accessToken) {
  const { data } = await axios.get(`${GRAPH}/${igBusinessId}/subscribed_apps`, {
    params: { access_token: accessToken },
  });
  return data;
}

module.exports = { exchangeCodeForToken, getLongLivedToken, getMyProfile, sendDirectMessage, replyToComment, setCommentHidden, subscribeAccountWebhooks, getSubscribedApps };