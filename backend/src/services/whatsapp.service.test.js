describe('whatsapp.service xavfsizligi va Graph so‘rovlari', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.WHATSAPP_APP_SECRET = 'wa-test-secret';
    process.env.WHATSAPP_VERIFY_TOKEN = 'wa-verify';
    process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    global.fetch = jest.fn();
  });

  afterEach(() => { delete global.fetch; });

  test('webhook challenge va HMAC imzosini tekshiradi', () => {
    const crypto = require('crypto');
    const wa = require('./whatsapp.service');
    expect(wa.verifyChallenge({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wa-verify', 'hub.challenge': '42' })).toBe('42');
    const body = Buffer.from('{"object":"whatsapp_business_account"}');
    const signature = `sha256=${crypto.createHmac('sha256', 'wa-test-secret').update(body).digest('hex')}`;
    expect(wa.verifySignature(body, signature)).toBe(true);
    expect(wa.verifySignature(body, 'sha256=bad')).toBe(false);
  });

  test('matn Graph messages endpointiga yuboriladi', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: 'wamid.1' }] }) });
    const wa = require('./whatsapp.service');
    const result = await wa.sendText('token', '12345', '998901112233', 'Salom');
    expect(result.messages[0].id).toBe('wamid.1');
    expect(global.fetch.mock.calls[0][0]).toContain('/12345/messages');
    expect(global.fetch.mock.calls[0][1].headers.authorization).toBe('Bearer token');
  });
});
