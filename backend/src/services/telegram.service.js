const crypto = require('crypto');

const apiBase = (token) => `https://api.telegram.org/bot${token}`;

async function tgCall(token, method, body) {
  const res = await fetch(`${apiBase(token)}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || `Telegram ${method} xatosi`);
  return data.result;
}

// Har agentlik uchun webhook maxfiy tokeni — bot tokenidan deterministik hosil qilinadi
// (alohida ustun kerak emas). Telegram X-Telegram-Bot-Api-Secret-Token header'ida qaytaradi.
function webhookSecret(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 48);
}

const getMe = (token) => tgCall(token, 'getMe');
const setWebhook = (token, url, secret) =>
  tgCall(token, 'setWebhook', { url, secret_token: secret, allowed_updates: ['message'], drop_pending_updates: true });
const deleteWebhook = (token) => tgCall(token, 'deleteWebhook', {});
const sendMessage = (token, chatId, text) => tgCall(token, 'sendMessage', { chat_id: chatId, text });

// Bot profili — CRM'dan boshqariladi (rasm/avatar Bot API'da yo'q, faqat @BotFather)
const getMyName = (token) => tgCall(token, 'getMyName');
const setMyName = (token, name) => tgCall(token, 'setMyName', { name });
const getMyDescription = (token) => tgCall(token, 'getMyDescription');
const setMyDescription = (token, description) => tgCall(token, 'setMyDescription', { description });
const getMyShortDescription = (token) => tgCall(token, 'getMyShortDescription');
const setMyShortDescription = (token, shortDescription) => tgCall(token, 'setMyShortDescription', { short_description: shortDescription });
const getMyCommands = (token) => tgCall(token, 'getMyCommands');
const setMyCommands = (token, commands) => tgCall(token, 'setMyCommands', { commands });

module.exports = {
  tgCall, getMe, setWebhook, deleteWebhook, sendMessage, webhookSecret,
  getMyName, setMyName, getMyDescription, setMyDescription,
  getMyShortDescription, setMyShortDescription, getMyCommands, setMyCommands,
};
