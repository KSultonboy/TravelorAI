// Tranzaksion email shablonlari: HTML escape, ism uzunligi va kodlar logga yozilmasligi.
jest.mock('../src/config/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));

const { logger } = require('../src/config/logger');
const emailService = require('../src/services/email.service');

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.ALLOW_DEV_CODES;
});

test('escapeHtml barcha maxsus belgilarni almashtiradi', () => {
  expect(emailService.escapeHtml(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
});

test('log rejimida kod logga yozilmaydi va devCode qaytmaydi', async () => {
  const result = await emailService.sendVerificationCodeEmail({ email: 'a@x.uz', name: 'Ali', code: '482913', expiresInMinutes: 10 });
  expect(result).toEqual({ delivery: 'log' });
  const logged = JSON.stringify(logger.info.mock.calls);
  expect(logged).not.toContain('482913');
});

test('ALLOW_DEV_CODES=true (dev) bo‘lsa devCode qaytadi, lekin baribir logga yozilmaydi', async () => {
  process.env.ALLOW_DEV_CODES = 'true';
  const result = await emailService.sendPasswordResetCodeEmail({ email: 'a@x.uz', name: 'Ali', code: '111222', expiresInMinutes: 10 });
  expect(result.devCode).toBe('111222');
  expect(JSON.stringify(logger.info.mock.calls)).not.toContain('111222');
});

test('ism HTML sifatida emas, matn sifatida chiqadi', async () => {
  const sendMail = jest.fn().mockResolvedValue({});
  process.env.SMTP_HOST = 'smtp.test';
  process.env.SMTP_PORT = '465';

  let isolated;
  jest.isolateModules(() => {
    jest.doMock('nodemailer', () => ({ createTransport: () => ({ sendMail }) }));
    isolated = require('../src/services/email.service');
  });
  await isolated.sendVerificationCodeEmail({ email: 'a@x.uz', name: '<img src=x onerror=alert(1)>', code: '123456', expiresInMinutes: 10 });
  await isolated.sendPasswordResetCodeEmail({ email: 'a@x.uz', name: '<script>x</script>', code: '123456', expiresInMinutes: 10 });
  await isolated.sendAccountDeleteCodeEmail({ email: 'a@x.uz', name: '"><b>', code: '123456', expiresInMinutes: 10 });

  expect(sendMail).toHaveBeenCalledTimes(3);
  for (const [mail] of sendMail.mock.calls) {
    expect(mail.html).not.toMatch(/<img|<script|"><b>/);
  }
  expect(sendMail.mock.calls[0][0].html).toContain('&lt;img src=x onerror=alert(1)&gt;');
});
