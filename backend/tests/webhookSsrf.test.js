// Outbound webhook SSRF himoyasi: IPv4-mapped IPv6, DNS rebinding (bir marta
// resolve + IP pin), redirect taqiqi va javob tanasini saqlamaslik.
process.env.APP_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

const dns = require('dns');

const mockPrisma = {
  webhookDelivery: { updateMany: jest.fn(), findUnique: jest.fn(), update: jest.fn((args) => args) },
  webhookEndpoint: { update: jest.fn((args) => args) },
  $transaction: jest.fn(async (ops) => ops),
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

const webhook = require('../src/services/webhookDelivery.service');
const { encryptSecret } = require('../src/services/dataEncryption.service');

const ORIGINAL_ENV = process.env.NODE_ENV;

function deliveryRow(url) {
  return {
    id: 'd1', endpointId: 'e1', attempt: 1, maxAttempts: 6, nextAttemptAt: new Date(),
    endpoint: { id: 'e1', active: true, url, secretEncrypted: encryptSecret('whsec_x') },
    event: { id: 'ev1', type: 'lead.created', createdAt: new Date(), agencyId: 'ag1', payload: { a: 1 } },
  };
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  process.env.NODE_ENV = 'test';
  mockPrisma.webhookDelivery.updateMany.mockResolvedValue({ count: 1 });
});
afterAll(() => { process.env.NODE_ENV = ORIGINAL_ENV; });

describe('isPrivateIp / normalizeIp', () => {
  test.each([
    '127.0.0.1', '10.0.0.5', '169.254.169.254', '100.100.100.200', '0.0.0.0', '255.255.255.255',
    '::1', '::', 'fe80::1', 'fe80::1%eth0', 'fd00:ec2::254', 'fc00::1', 'ff02::1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '[::ffff:169.254.169.254]', '0:0:0:0:0:ffff:a00:1',
    '::127.0.0.1', '64:ff9b::a9fe:a9fe', '2002:7f00:1::1', 'not-an-ip',
  ])('%s bloklanadi', (ip) => {
    expect(webhook.isPrivateIp(ip)).toBe(true);
  });

  test.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])('%s public', (ip) => {
    expect(webhook.isPrivateIp(ip)).toBe(false);
  });

  test('IPv4-mapped IPv6 IPv4 ko‘rinishiga keltiriladi', () => {
    expect(webhook.normalizeIp('::ffff:7f00:1')).toEqual({ address: '127.0.0.1', family: 4 });
  });

  test('URL ichidagi IP literal yaratishda rad etiladi', () => {
    expect(() => webhook.validateWebhookUrl('http://[::ffff:127.0.0.1]/hook')).toThrow();
    expect(() => webhook.validateWebhookUrl('http://169.254.169.254/latest')).toThrow();
    expect(() => webhook.validateWebhookUrl('https://hooks.example.com/x')).not.toThrow();
  });

  test('productionda faqat HTTPS', () => {
    process.env.NODE_ENV = 'production';
    expect(() => webhook.validateWebhookUrl('http://hooks.example.com/x')).toThrow(/HTTPS/);
  });
});

describe('resolvePublicDestination', () => {
  test('bitta javob ham private bo‘lsa bloklanadi', async () => {
    jest.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }, { address: '::ffff:10.0.0.1', family: 6 }]);
    await expect(webhook.resolvePublicDestination('https://hooks.example.com/x')).rejects.toThrow(/private/);
  });

  test('public manzil qaytariladi', async () => {
    jest.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    await expect(webhook.resolvePublicDestination('https://hooks.example.com/x')).resolves.toEqual({ address: '93.184.216.34', family: 4 });
  });
});

describe('deliverWebhook', () => {
  test('DNS rebinding: bir marta resolve qilinadi va transport aynan tekshirilgan IP’ga ulanadi', async () => {
    const lookup = jest.spyOn(dns.promises, 'lookup')
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValue([{ address: '127.0.0.1', family: 4 }]); // ikkinchi resolve bo'lsa — ichki manzil
    mockPrisma.webhookDelivery.findUnique.mockResolvedValue(deliveryRow('https://rebind.example.com/hook'));
    const transport = jest.fn(async () => ({ status: 200 }));

    const result = await webhook.deliverWebhook({ id: 'd1' }, { transport });

    expect(result.success).toBe(true);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith('https://rebind.example.com/hook', { address: '93.184.216.34', family: 4 }, expect.any(Object));
    const successUpdate = mockPrisma.webhookDelivery.update.mock.calls.at(-1)[0];
    expect(successUpdate.data.responseBody).toBeNull();
    expect(successUpdate.data.responseStatus).toBe(200);
  });

  test('IPv4-mapped IPv6 ga resolve bo‘lgan host yuborilmaydi', async () => {
    jest.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address: '::ffff:169.254.169.254', family: 6 }]);
    mockPrisma.webhookDelivery.findUnique.mockResolvedValue(deliveryRow('https://metadata.example.com/'));
    const transport = jest.fn();

    const result = await webhook.deliverWebhook({ id: 'd1' }, { transport });

    expect(result.success).toBe(false);
    expect(transport).not.toHaveBeenCalled();
  });

  test('redirect xato hisoblanadi, javob tanasi saqlanmaydi', async () => {
    jest.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    mockPrisma.webhookDelivery.findUnique.mockResolvedValue(deliveryRow('https://hooks.example.com/'));
    const transport = jest.fn(async () => ({ status: 302 }));

    const result = await webhook.deliverWebhook({ id: 'd1' }, { transport });

    expect(result.success).toBe(false);
    const failUpdate = mockPrisma.webhookDelivery.update.mock.calls.at(-1)[0];
    expect(failUpdate.data.error).toMatch(/redirect/);
    expect(failUpdate.data.responseStatus).toBe(302);
    expect(failUpdate.data.responseBody).toBeNull();
  });

  test('productionda http endpoint yetkazilmaydi, allowPrivate e’tiborga olinmaydi', async () => {
    process.env.NODE_ENV = 'production';
    const lookup = jest.spyOn(dns.promises, 'lookup');
    mockPrisma.webhookDelivery.findUnique.mockResolvedValue(deliveryRow('http://hooks.example.com/'));
    const transport = jest.fn();

    const result = await webhook.deliverWebhook({ id: 'd1' }, { transport, allowPrivate: true });

    expect(result.success).toBe(false);
    expect(transport).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
  });
});
