// Anthropic API — AI yordamchilar uchun yagona kirish nuqtasi.
// Kalit yoki kutubxona bo'lmasa xizmat jimgina o'chiq turadi (UI tugmani yashiradi).
//
// MUHIM: prod deploy overlay'i package.json'ni nusxalaydi, lekin `npm install`
// QILMAYDI. Shuning uchun SDK'ni fayl boshida require QILMAYMIZ — aks holda
// kutubxona o'rnatilmagan image'da backend umuman ko'tarilmaydi va deploy
// rollback bo'ladi (2026-07-20 da aynan shunday bo'lgan).
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

let Anthropic = null;
let sdkChecked = false;

function loadSdk() {
  if (!sdkChecked) {
    sdkChecked = true;
    try {
      Anthropic = require('@anthropic-ai/sdk');
    } catch {
      Anthropic = null;
    }
  }
  return Anthropic;
}

let client = null;
function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const Sdk = loadSdk();
  if (!Sdk) return null;
  if (!client) client = new Sdk({ apiKey: key });
  return client;
}

// Kalit HAM, kutubxona HAM bo'lsagina "sozlangan" hisoblanadi.
function isConfigured() {
  return !!process.env.ANTHROPIC_API_KEY && !!loadSdk();
}

/**
 * Matn generatsiyasi. Qisqa javoblar uchun — thinking va streaming kerak emas.
 * Xato bo'lsa tushunarli xabar qaytaradi, stack tashqariga chiqmaydi.
 */
async function generate({ system, prompt, maxTokens = 700 }) {
  const anthropic = getClient();
  if (!anthropic) {
    const err = new Error(
      loadSdk()
        ? 'AI hali sozlanmagan (ANTHROPIC_API_KEY yo‘q)'
        : 'AI kutubxonasi image‘da o‘rnatilmagan (@anthropic-ai/sdk)'
    );
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (res.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  return {
    text,
    usage: {
      input: res.usage ? res.usage.input_tokens : 0,
      output: res.usage ? res.usage.output_tokens : 0,
    },
  };
}

module.exports = { generate, isConfigured, MODEL };
