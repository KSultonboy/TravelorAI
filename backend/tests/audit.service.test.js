jest.mock('../src/config/database', () => ({ prisma: { auditLog: { create: jest.fn() } } }));
const { inferEntity, sanitizeForAudit } = require('../src/services/audit.service');

test('audit maxfiy qiymatlarni yashiradi', () => {
  expect(sanitizeForAudit({ password: 'x', nested: { telegramBotToken: 'y', title: 'ok' } })).toEqual({
    password: '[redacted]', nested: { telegramBotToken: '[redacted]', title: 'ok' },
  });
});

test('audit URLdan entityni aniqlaydi', () => {
  expect(inferEntity('/api/v1/agency/bookings/lead-1/stage')).toEqual({ entityType: 'bookings', entityId: 'lead-1' });
});
