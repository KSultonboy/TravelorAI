const fs = require('fs');
const os = require('os');
const path = require('path');
const { configure, mergeEnv, validateApiKey } = require('../scripts/configureResendSmtp');
const { loadEnvFile } = require('../scripts/verifyResendSmtp');

describe('Resend SMTP xavfsiz sozlagichi', () => {
  test('faqat Resend formatidagi keyni qabul qiladi', () => {
    expect(validateApiKey('re_abcdefghijklmnop')).toBe('re_abcdefghijklmnop');
    expect(() => validateApiKey('gmail-password')).toThrow('re_');
  });

  test('mavjud ENV qiymatlarini almashtiradi va boshqalarini saqlaydi', () => {
    const result = mergeEnv('DATABASE_URL=postgres://db\nSMTP_HOST=old\nSMTP_PASS=old-secret\n', 're_abcdefghijklmnop');
    expect(result).toContain('DATABASE_URL=postgres://db');
    expect(result).toContain('SMTP_HOST=smtp.resend.com');
    expect(result).toContain('SMTP_PASS=re_abcdefghijklmnop');
    expect(result).not.toContain('old-secret');
  });

  test('atomik yozadi va oldingi ENV backupini yaratadi', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'travelorai-resend-'));
    const envPath = path.join(directory, '.env');
    fs.writeFileSync(envPath, 'DATABASE_URL=postgres://db\n', 'utf8');
    try {
      const result = configure(envPath, 're_abcdefghijklmnop');
      expect(fs.readFileSync(envPath, 'utf8')).toContain('SMTP_USER=resend');
      expect(result.backupPath).toBeTruthy();
      expect(fs.readFileSync(result.backupPath, 'utf8')).toContain('DATABASE_URL=postgres://db');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test('SMTP tekshiruvchi /tmp ichida ham ENV faylini dependency siz o‘qiydi', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'travelorai-resend-verify-'));
    const envPath = path.join(directory, '.env');
    fs.writeFileSync(envPath, 'SMTP_HOST=smtp.resend.com\nSMTP_PORT="465"\n', 'utf8');
    try {
      loadEnvFile(envPath);
      expect(process.env.SMTP_HOST).toBe('smtp.resend.com');
      expect(process.env.SMTP_PORT).toBe('465');
    } finally {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
