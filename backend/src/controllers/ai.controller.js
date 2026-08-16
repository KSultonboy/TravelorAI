// AI yordamchilar (Premium). Hozircha: taklif uchun shaxsiy izoh yozish.
// Muhim qoida: AI FAQAT berilgan ma'lumotdan foydalanadi — narx, sana yoki
// xizmatni o'zi o'ylab topmasligi kerak, aks holda mijozga yolg'on va'da beriladi.
const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { ensureApprovedAgency } = require('./agency.controller');
const ai = require('../services/ai.service');

const SYSTEM = `Sen O'zbekistondagi sayohat agentligining tajribali sotuv menejerisan.
Vazifang — mijozga yuboriladigan shaxsiy taklif uchun QISQA izoh yozish.

QAT'IY QOIDALAR:
- Faqat o'zbek tilida, lotin alifbosida yoz. Kirill harflari ISHLATMA.
- 2-4 ta gap. Uzun yozma.
- FAQAT berilgan ma'lumotdan foydalan. Narx, sana, mehmonxona nomi, chegirma yoki
  boshqa tafsilotni O'ZING O'YLAB TOPMA. Ma'lumot yo'q bo'lsa — o'sha haqda yozma.
- Mijozga ismi bilan murojaat qil (agar berilgan bo'lsa).
- Iliq, hurmatli, lekin ortiqcha maqtovsiz. "Ajoyib imkoniyat!", "Shoshiling!" kabi
  bosim o'tkazuvchi iboralar ishlatma.
- Emoji ishlatma. Markdown, sarlavha yoki ro'yxat ishlatma — oddiy matn.
- Imzo qo'yma (agentlik nomi avtomatik qo'shiladi).
- Javobingda faqat izohning o'zi bo'lsin, hech qanday tushuntirish yoki qo'shtirnoq qo'shma.`;

function line(label, value) {
  const v = String(value === null || value === undefined ? '' : value).trim();
  return v ? `${label}: ${v}\n` : '';
}

async function status(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    return success(res, { configured: ai.isConfigured() });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function presentationNote(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    if (!ai.isConfigured()) {
      return error(res, 'AI hali sozlanmagan. Administrator ANTHROPIC_API_KEY qo‘shishi kerak.', 503, {
        code: 'AI_NOT_CONFIGURED',
      });
    }

    const body = req.body || {};

    const booking = body.bookingId
      ? await prisma.tourBooking.findFirst({
          where: { id: String(body.bookingId), agencyId: agency.id },
          include: { tour: { select: { title: true } } },
        })
      : null;

    const tour = body.tourId
      ? await prisma.tour.findFirst({ where: { id: String(body.tourId), agencyId: agency.id } })
      : null;

    if (!booking && !tour) return error(res, 'Lid yoki tur tanlang', 400);

    // Telegram yozishmasi — izohni haqiqatan shaxsiy qiladigan asosiy manba
    let chat = '';
    if (booking) {
      const msgs = await prisma.telegramMessage.findMany({
        where: { agencyId: agency.id, bookingId: booking.id },
        orderBy: { createdAt: 'desc' },
        take: 14,
        select: { direction: true, text: true },
      });
      chat = msgs
        .reverse()
        .map((m) => `${m.direction === 'in' ? 'Mijoz' : 'Agent'}: ${String(m.text || '').slice(0, 300)}`)
        .join('\n');
    }

    let context = '';
    context += line('Mijoz ismi', booking && booking.customerName);
    context += line('Mijoz qiziqqan yo‘nalish', booking && booking.leadTour);
    context += line('Mijozning birinchi xabari', booking && booking.message);
    context += line('Sayohat sanasi', booking && booking.travelDate ? new Date(booking.travelDate).toISOString().slice(0, 10) : '');
    context += line('Sayohatchilar soni', booking && booking.travelers);
    context += line('Agentlik nomi', agency.name);

    if (tour) {
      context += '\n--- Taklif qilinayotgan tur ---\n';
      context += line('Tur nomi', tour.title);
      context += line('Shahar / yo‘nalish', [tour.city, tour.destinationCountry].filter(Boolean).join(', '));
      context += line('Qisqa tavsif', tour.subtitle);
      context += line('Davomiyligi', tour.duration);
      context += line('Kechalar', tour.nights);
      context += line('Mehmonxona', [tour.hotelName, tour.hotelCategory].filter(Boolean).join(' '));
      context += line('Ovqatlanish', tour.mealPlanLabel);
      context += line('Xizmatlar', (tour.highlights || []).join(', '));
      context += line('Narxga kiritilgan', (tour.priceIncludes || []).join(', '));
    }
    context += line('Taklif narxi', body.priceText || (tour && tour.price));

    if (chat) context += `\n--- Telegramdagi yozishma ---\n${chat}\n`;

    const prompt =
      `Quyidagi ma'lumot asosida mijozga yuboriladigan taklif uchun shaxsiy izoh yoz.\n` +
      `Agar yozishma berilgan bo'lsa — mijoz aynan nimaga e'tibor berganini ilg'ab, shunga javob ber.\n\n` +
      context;

    const out = await ai.generate({ system: SYSTEM, prompt, maxTokens: 500 });
    if (!out.text) return error(res, 'AI javob qaytarmadi, qayta urinib ko‘ring', 502);

    return success(res, { text: out.text, usage: out.usage, model: ai.MODEL });
  } catch (err) {
    if (err.code === 'AI_NOT_CONFIGURED') return error(res, err.message, 503, { code: err.code });
    return error(res, `AI xatosi: ${err.message}`, 502);
  }
}

module.exports = { status, presentationNote };
