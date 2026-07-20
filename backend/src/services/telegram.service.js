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
// MUHIM: callback_query ham kerak — usiz inline tugma bosishlari umuman kelmaydi.
const setWebhook = (token, url, secret) =>
  tgCall(token, 'setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  });
const deleteWebhook = (token) => tgCall(token, 'deleteWebhook', {});
// extra — reply_markup va boshqa Bot API maydonlari uchun (eski chaqiruvlar buzilmaydi)
const sendMessage = (token, chatId, text, extra = {}) =>
  tgCall(token, 'sendMessage', { chat_id: chatId, text, ...extra });
const answerCallbackQuery = (token, callbackQueryId, text) =>
  tgCall(token, 'answerCallbackQuery', { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });

// Bot profili — CRM'dan boshqariladi (rasm/avatar Bot API'da yo'q, faqat @BotFather)
const getMyName = (token) => tgCall(token, 'getMyName');
const setMyName = (token, name) => tgCall(token, 'setMyName', { name });
const getMyDescription = (token) => tgCall(token, 'getMyDescription');
const setMyDescription = (token, description) => tgCall(token, 'setMyDescription', { description });
const getMyShortDescription = (token) => tgCall(token, 'getMyShortDescription');
const setMyShortDescription = (token, shortDescription) => tgCall(token, 'setMyShortDescription', { short_description: shortDescription });
// Bot menyusidagi tugma — Mini App'ni ochadi
const setChatMenuButton = (token, menuButton) => tgCall(token, 'setChatMenuButton', { menu_button: menuButton });
const getMyCommands = (token) => tgCall(token, 'getMyCommands');
const setMyCommands = (token, commands) => tgCall(token, 'setMyCommands', { commands });

module.exports = {
  tgCall, getMe, setWebhook, deleteWebhook, sendMessage, answerCallbackQuery, webhookSecret,
  getMyName, setMyName, getMyDescription, setMyDescription,
  getMyShortDescription, setMyShortDescription, getMyCommands, setMyCommands, setChatMenuButton,
};
