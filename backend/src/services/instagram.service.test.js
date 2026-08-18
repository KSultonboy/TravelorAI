describe('instagram.service xavfsizlik yordamchilari', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.INSTAGRAM_APP_ID = '123456';
    process.env.INSTAGRAM_APP_SECRET = 'test-app-secret';
    process.env.INSTAGRAM_VERIFY_TOKEN = 'verify-token';
    process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  });

  test('access token AES-256-GCM bilan shifrlanadi', () => {
    const ig = require('./instagram.service');
    const encrypted = ig.encryptToken('secret-access-token');
    expect(encrypted).not.toContain('secret-access-token');
    expect(ig.decryptToken(encrypted)).toBe('secret-access-token');
  });

  test('OAuth state imzosi va muddati tekshiriladi', () => {
    const ig = require('./instagram.service');
    const state = ig.signState('agency-1');
    expect(ig.verifyState(state)).toBe('agency-1');
    expect(ig.verifyState(`${state}x`)).toBeNull();
  });

  test('webhook xom body HMAC imzosi tekshiriladi', () => {
    const crypto = require('crypto');
    const ig = require('./instagram.service');
    const body = Buffer.from('{"object":"instagram"}');
    const signature = `sha256=${crypto.createHmac('sha256', process.env.INSTAGRAM_APP_SECRET).update(body).digest('hex')}`;
    expect(ig.verifySignature(body, signature)).toBe(true);
    expect(ig.verifySignature(body, 'sha256=00')).toBe(false);
  });
});
