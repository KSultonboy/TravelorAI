// Fon rejalashtiruvchi — tug'ilgan kun tabrigi + sayohat eslatmasi.
// Yangi kutubxonasiz (setInterval), chunki prod overlay `npm install` qilmaydi.
// O'zbekiston vaqti (UTC+5, DST yo'q) bo'yicha ishlaydi.
const { prisma } = require('../config/database');
const tg = require('./telegram.service');

// Standart tabrik matni — agentlik o'zi o'zgartirmasa shu ishlatiladi.
// {name} = mijoz ismi, {agency} = agentlik nomi.
const DEFAULT_BIRTHDAY =
  "🎉 Hurmatli {name}!\n\n" +
  "{agency} jamoasi Sizni tug'ilgan kuningiz bilan chin dildan tabriklaydi! " +
  "Hayotingiz go'zal sayohatlar, quvonch va yangi taassurotlarga to'la bo'lsin.\n\n" +
  "Bayram kunlarida Siz uchun maxsus takliflarimiz tayyor. Yoqimli kayfiyat tilaymiz! 🌍";

function fillBirthday(tpl, name, agencyName) {
  return String(tpl && tpl.trim() ? tpl : DEFAULT_BIRTHDAY)
    .replace(/\{name\}/g, name || 'mijoz')
    .replace(/\{agency\}/g, agencyName || '');
}

const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Tashkent
const tashkentNow = () => new Date(Date.now() + TZ_OFFSET_MS);
const ymd = (d) => d.toISOString().slice(0, 10); // TZ-siljitilgan sanadan UTC qism = mahalliy sana

// Botга bir tekis yuborish (Telegram limitini buzmaslik)
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Tug'ilgan kun tabrigi — bugun tug'ilган kuni bo'lган, Telegramда bog'langan
 * mijozларга agentlik nomidan bir marta (kunига) yuboradi.
 */
async function runBirthdayGreetings() {
  const t = tashkentNow();
  const mm = t.getUTCMonth() + 1;
  const dd = t.getUTCDate();
  const todayStr = ymd(t);

  const rows = await prisma.tourBooking.findMany({
    where: {
      customerBirthday: { not: null },
      telegramChatId: { not: null },
      agency: { telegramBotActive: true, NOT: { telegramBotToken: null } },
    },
    select: {
      id: true, customerName: true, customerBirthday: true, birthdayGreetedOn: true,
      telegramChatId: true, agencyId: true,
      agency: { select: { name: true, telegramBotToken: true, birthdayTemplate: true } },
    },
    take: 1000,
  });

  const seen = new Set();
  let sent = 0;
  for (const b of rows) {
    const bd = new Date(b.customerBirthday);
    if (bd.getUTCMonth() + 1 !== mm || bd.getUTCDate() !== dd) continue; // bugun emas
    if (b.birthdayGreetedOn === todayStr) continue; // bugun allaqachon tabriklangan
    const key = b.agencyId + '|' + b.telegramChatId;
    if (seen.has(key)) continue; // bir mijozга bir marta
    seen.add(key);

    const text = fillBirthday(b.agency.birthdayTemplate, b.customerName, b.agency.name);
    try {
      await tg.sendMessage(b.agency.telegramBotToken, b.telegramChatId, text);
      await prisma.telegramMessage.create({
        data: { agencyId: b.agencyId, bookingId: b.id, direction: 'out', text, fromName: 'Tabrik' },
      });
      sent += 1;
    } catch { /* yuborilmasa keyingi tekshiruvда qayta urinadi */ }

    // Shu mijozning barcha yozuvlarини "bugun tabriklangan" deб belgilaymiz
    await prisma.tourBooking
      .updateMany({
        where: { agencyId: b.agencyId, telegramChatId: b.telegramChatId },
        data: { birthdayGreetedOn: todayStr },
      })
      .catch(() => {});
    await pause(60);
  }
  return sent;
}

/**
 * Sayohat eslatmasi — kelishilган/yakunlanган bronда sayohat 2 kun ichида
 * bo'lса, mijozга bir marta eslatma yuboradi.
 */
async function runTripReminders() {
  const now = new Date();
  const in2 = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const rows = await prisma.tourBooking.findMany({
    where: {
      travelDate: { gte: now, lte: in2 },
      telegramChatId: { not: null },
      tripReminderSentAt: null,
      pipelineStage: { in: ['won', 'completed'] },
      agency: { telegramBotActive: true, NOT: { telegramBotToken: null } },
    },
    select: {
      id: true, customerName: true, travelDate: true, leadTour: true, telegramChatId: true, agencyId: true,
      agency: { select: { name: true, telegramBotToken: true } },
      tour: { select: { title: true } },
    },
    take: 1000,
  });

  let sent = 0;
  for (const b of rows) {
    const trip = (b.tour && b.tour.title) || b.leadTour || 'sayohatingiz';
    const dateStr = new Date(b.travelDate).toLocaleDateString('uz-UZ');
    const text =
      `✈️ Hurmatli ${b.customerName}!\n\n` +
      `«${trip}» sayohatingiz yaqinlashmoqda — ${dateStr}. ` +
      `Tayyorgarlik va savollaringiz bo'yicha ${b.agency.name} bilan bog'laning. Yoqimli sayohat tilaymiz!`;
    try {
      await tg.sendMessage(b.agency.telegramBotToken, b.telegramChatId, text);
      await prisma.telegramMessage.create({
        data: { agencyId: b.agencyId, bookingId: b.id, direction: 'out', text, fromName: 'Eslatma' },
      });
      sent += 1;
    } catch { /* keyingi tekshiruvда qayta */ }
    await prisma.tourBooking
      .update({ where: { id: b.id }, data: { tripReminderSentAt: new Date() } })
      .catch(() => {});
    await pause(60);
  }
  return sent;
}

let started = false;
function startScheduler() {
  if (started) return;
  started = true;
  const tick = async () => {
    try { await runBirthdayGreetings(); } catch { /* ignore */ }
    try { await runTripReminders(); } catch { /* ignore */ }
  };
  setTimeout(tick, 45_000); // boot'дан 45s keyin bir marta
  setInterval(tick, 30 * 60 * 1000); // keyin har 30 daqiqada
}

module.exports = { startScheduler, runBirthdayGreetings, runTripReminders, DEFAULT_BIRTHDAY, fillBirthday };
