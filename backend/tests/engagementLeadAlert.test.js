// Engagement A: lid xabarnomasi matni/tugmalari, sozlama (toggle) va
// "✅ Qabul qildim" callback'i — faqat o'z agentligi uchun firstResponseAt qo'yadi.
const AGENCY_A = { id: 'ag-a', name: 'A', telegramBotToken: '111:aaa', telegramBotActive: true, notifyChatId: '1001' };
const AGENCY_B = { id: 'ag-b', name: 'B', telegramBotToken: '222:bbb', telegramBotActive: true, notifyChatId: '2002' };
const AGENCIES = { 'ag-a': AGENCY_A, 'ag-b': AGENCY_B };
const BOOKINGS = { 'bk-a': { id: 'bk-a', agencyId: 'ag-a', firstResponseAt: null }, 'bk-b': { id: 'bk-b', agencyId: 'ag-b', firstResponseAt: null } };

const mockPrisma = {
  tourAgency: { findUnique: jest.fn() },
  tour: { findUnique: jest.fn(async () => ({ title: 'Istanbul 4 kun' })) },
  tourBooking: {
    findFirst: jest.fn(async ({ where }) => {
      const b = BOOKINGS[where.id];
      return b && b.agencyId === where.agencyId ? { ...b } : null;
    }),
    updateMany: jest.fn(async ({ where }) => ({ count: BOOKINGS[where.id] && BOOKINGS[where.id].agencyId === where.agencyId ? 1 : 0 })),
  },
  leadActivity: { create: jest.fn(async () => ({})) },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));
jest.mock('../src/services/telegram.service', () => ({
  ...jest.requireActual('../src/services/telegram.service'),
  sendMessage: jest.fn(async () => ({})),
  answerCallbackQuery: jest.fn(async () => ({})),
  tgCall: jest.fn(async () => ({})),
}));

const express = require('express');
const request = require('supertest');
const tg = require('../src/services/telegram.service');
const leadAlert = require('../src/services/leadAlert.service');

const app = express();
app.use(express.json());
app.use('/telegram', require('../src/routes/telegram.routes'));

function withSettings(agency, settings) {
  return { ...agency, crmSettings: settings === undefined ? null : settings };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.tourAgency.findUnique.mockImplementation(async ({ where }) => (AGENCIES[where.id] ? withSettings(AGENCIES[where.id]) : null));
});

describe('notifyNewLead', () => {
  const booking = {
    id: 'bk-a', agencyId: 'ag-a', tourId: 't1', customerName: 'Ali Valiyev', customerPhone: '90 123 45 67',
    travelers: 3, travelDate: new Date('2026-12-20T00:00:00Z'), message: 'Oilam bilan borishni xohlaymiz', source: 'web',
  };

  test('xabarnoma chatiga matn + imzolangan "Qabul qildim" va CRM tugmasi', async () => {
    const out = await leadAlert.notifyNewLead(booking, { source: 'web' });
    expect(out).toEqual({ sent: true });
    expect(tg.sendMessage).toHaveBeenCalledTimes(1);
    const [token, chatId, text, extra] = tg.sendMessage.mock.calls[0];
    expect(token).toBe('111:aaa');
    expect(chatId).toBe('1001');
    expect(text).toContain('Yangi lid · Sayt');
    expect(text).toContain('Tur: Istanbul 4 kun');
    expect(text).toContain('Ali Valiyev');
    expect(text).toContain('+998901234567');
    expect(text).toContain('Kishi soni: 3');
    expect(text).toContain('20.12.2026');
    expect(text).toContain('Oilam bilan');
    const [[accept], [open]] = extra.reply_markup.inline_keyboard;
    expect(accept.text).toBe('✅ Qabul qildim');
    expect(accept.callback_data).toBe(`la:bk-a:${leadAlert.signLeadCallback('ag-a', 'bk-a')}`);
    expect(Buffer.byteLength(accept.callback_data)).toBeLessThanOrEqual(64);
    expect(open.url).toMatch(/\/agency$/);
  });

  test('sozlamada o‘chirilgan bo‘lsa yuborilmaydi', async () => {
    mockPrisma.tourAgency.findUnique.mockResolvedValueOnce(withSettings(AGENCY_A, { leadAlertsEnabled: false }));
    expect(await leadAlert.notifyNewLead(booking, { source: 'web' })).toEqual({ sent: false, reason: 'disabled' });
    expect(tg.sendMessage).not.toHaveBeenCalled();
  });

  test('xabarnoma chati ulanmagan bo‘lsa yuborilmaydi', async () => {
    mockPrisma.tourAgency.findUnique.mockResolvedValueOnce(withSettings({ ...AGENCY_A, notifyChatId: null }));
    expect((await leadAlert.notifyNewLead(booking)).sent).toBe(false);
    expect(tg.sendMessage).not.toHaveBeenCalled();
  });

  test('Telegram xatosi tashqariga chiqmaydi', async () => {
    tg.sendMessage.mockRejectedValueOnce(new Error('Bad Request: chat not found'));
    await expect(leadAlert.notifyNewLead(booking)).resolves.toEqual({ sent: false, reason: 'error' });
  });

  test('CSV import jamlovchi xabari', async () => {
    await leadAlert.notifyLeadImport('ag-a', { count: 12, fileName: 'eski.csv' });
    expect(tg.sendMessage.mock.calls[0][2]).toContain('12 ta yangi lid import qilindi');
  });

  test('manba normallashtirish', () => {
    expect(leadAlert.normalizeBookingSource('web')).toBe('web');
    expect(leadAlert.normalizeBookingSource('mobile')).toBe('mobile');
    expect(leadAlert.normalizeBookingSource('storefront')).toBe('storefront');
    expect(leadAlert.normalizeBookingSource('landing-xyz')).toBe('web');
  });
});

describe('"✅ Qabul qildim" callback', () => {
  const secretA = () => tg.webhookSecret(AGENCY_A.telegramBotToken);
  const callback = (data, chatId = '1001') => ({
    callback_query: {
      id: 'cbq-1', data, from: { id: 42, first_name: 'Nodira' },
      message: { message_id: 77, chat: { id: chatId }, text: '🆕 Yangi lid · Sayt\n👤 Mijoz: Ali' },
    },
  });
  const post = (body) => request(app).post('/telegram/webhook/ag-a').set('x-telegram-bot-api-secret-token', secretA()).send(body);

  test('o‘z agentligi lidi → firstResponseAt, LeadActivity, xabar tahrirlanadi', async () => {
    const res = await post(callback(leadAlert.buildCallbackData('ag-a', 'bk-a')));
    expect(res.status).toBe(200);
    expect(mockPrisma.tourBooking.updateMany).toHaveBeenCalledWith({
      where: { id: 'bk-a', agencyId: 'ag-a', firstResponseAt: null },
      data: { firstResponseAt: expect.any(Date) },
    });
    expect(mockPrisma.leadActivity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ agencyId: 'ag-a', bookingId: 'bk-a', type: 'accepted', text: expect.stringContaining('Nodira') }),
    }));
    const edit = tg.tgCall.mock.calls.find((c) => c[1] === 'editMessageText');
    expect(edit[2]).toEqual(expect.objectContaining({ chat_id: '1001', message_id: 77, text: expect.stringContaining('✅ Qabul qildi: Nodira') }));
    expect(tg.answerCallbackQuery).toHaveBeenCalledWith('111:aaa', 'cbq-1', 'Qabul qilindi ✅');
  });

  test('boshqa agentlik lidi uchun yasalgan (soxta) callback rad etiladi', async () => {
    // B agentligining lidi va imzosi A botiga yuborildi.
    const res = await post(callback(leadAlert.buildCallbackData('ag-b', 'bk-b')));
    expect(res.status).toBe(200);
    expect(mockPrisma.tourBooking.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.leadActivity.create).not.toHaveBeenCalled();
    expect(tg.answerCallbackQuery).toHaveBeenCalledWith('111:aaa', 'cbq-1', 'Ruxsat yo‘q');
  });

  test('A imzosi bilan B lidi — imzo mos emas, rad', async () => {
    const forged = `la:bk-b:${leadAlert.signLeadCallback('ag-a', 'bk-a')}`;
    await post(callback(forged));
    expect(mockPrisma.tourBooking.updateMany).not.toHaveBeenCalled();
  });

  test('A imzosi to‘g‘ri, lekin lid B ga tegishli → topilmaydi, yangilanmaydi', async () => {
    await post(callback(leadAlert.buildCallbackData('ag-a', 'bk-b')));
    expect(mockPrisma.tourBooking.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'bk-b', agencyId: 'ag-a' } }));
    expect(mockPrisma.tourBooking.updateMany).not.toHaveBeenCalled();
    expect(tg.answerCallbackQuery).toHaveBeenCalledWith('111:aaa', 'cbq-1', 'Lid topilmadi');
  });

  test('xabarnoma chatidan boshqa chatdan bosilsa rad etiladi', async () => {
    await post(callback(leadAlert.buildCallbackData('ag-a', 'bk-a'), '5555'));
    expect(mockPrisma.tourBooking.updateMany).not.toHaveBeenCalled();
  });

  test('webhook maxfiy sarlavhasi noto‘g‘ri → 403, hech narsa o‘zgarmaydi', async () => {
    const res = await request(app).post('/telegram/webhook/ag-a').set('x-telegram-bot-api-secret-token', 'wrong')
      .send(callback(leadAlert.buildCallbackData('ag-a', 'bk-a')));
    expect(res.status).toBe(403);
    expect(mockPrisma.tourBooking.updateMany).not.toHaveBeenCalled();
  });

  test('allaqachon javob berilgan lid — vaqt qayta yozilmaydi', async () => {
    mockPrisma.tourBooking.updateMany.mockResolvedValueOnce({ count: 0 });
    await post(callback(leadAlert.buildCallbackData('ag-a', 'bk-a')));
    expect(mockPrisma.leadActivity.create).not.toHaveBeenCalled();
    expect(tg.answerCallbackQuery).toHaveBeenCalledWith('111:aaa', 'cbq-1', 'Bu lid allaqachon qabul qilingan');
  });

  test('boshqa callback\'lar (rate:, dest:) eski oqimga o‘tadi', async () => {
    expect(await leadAlert.handleLeadAcceptCallback(AGENCY_A, { id: 'x', data: 'rate:bk-a:5' })).toBe(false);
  });
});
