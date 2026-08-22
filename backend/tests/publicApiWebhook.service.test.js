describe('public API key and webhook security', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.APP_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString('base64');
  });

  test('API key hash is deterministic and scopes are allowlisted', () => {
    const { hashApiKey, normalizeScopes } = require('../src/services/publicApiKey.service');
    expect(hashApiKey('tai_live_demo')).toHaveLength(64);
    expect(hashApiKey('tai_live_demo')).toBe(hashApiKey('tai_live_demo'));
    expect(normalizeScopes(['leads:read', 'admin:*', 'leads:read', 'finance:read'])).toEqual(['leads:read', 'finance:read']);
  });

  test('webhook secret is encrypted and decryptable', () => {
    const { encryptSecret, decryptSecret } = require('../src/services/dataEncryption.service');
    const encrypted = encryptSecret('whsec_very-secret');
    expect(encrypted).toMatch(/^enc:v1\./);
    expect(encrypted).not.toContain('very-secret');
    expect(decryptSecret(encrypted)).toBe('whsec_very-secret');
  });

  test('HMAC signature covers timestamp and exact raw body', () => {
    const { signWebhookPayload } = require('../src/services/webhookDelivery.service');
    const one = signWebhookPayload('whsec_test', '1720000000', '{"ok":true}');
    expect(one).toMatch(/^v1=[a-f0-9]{64}$/);
    expect(one).not.toBe(signWebhookPayload('whsec_test', '1720000001', '{"ok":true}'));
    expect(one).not.toBe(signWebhookPayload('whsec_test', '1720000000', '{"ok":false}'));
  });

  test('private destinations and invalid event values are blocked', () => {
    const { isPrivateIp, validateWebhookUrl, normalizeEvents, inferWebhookEvent } = require('../src/services/webhookDelivery.service');
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('10.1.2.3')).toBe(true);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(() => validateWebhookUrl('http://localhost/hook')).toThrow();
    expect(normalizeEvents(['lead.created', 'root.shell', 'lead.created'])).toEqual(['lead.created']);
    expect(inferWebhookEvent('/api/v1/agency/bookings/lead-1/stage', 'PATCH')).toBe('lead.stage_changed');
    expect(inferWebhookEvent('/api/v1/agency/crm/tasks', 'POST')).toBe('task.created');
  });
});
