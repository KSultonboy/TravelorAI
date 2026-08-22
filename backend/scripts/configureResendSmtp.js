const fs = require('fs');
const path = require('path');

const SETTINGS = {
  SMTP_HOST: 'smtp.resend.com',
  SMTP_PORT: '465',
  SMTP_SECURE: 'true',
  SMTP_USER: 'resend',
  MAIL_FROM: '"TravelorAI <no-reply@travelorai.com>"',
  SUPPORT_EMAIL: 'support@travelorai.com',
  SMTP_FALLBACK_DIRECT: 'false',
  SMTP_ALLOW_INVALID_TLS: 'false',
};

function validateApiKey(value) {
  const key = String(value || '').trim();
  if (!/^re_[A-Za-z0-9_-]{12,}$/.test(key)) throw new Error('Resend API key noto‘g‘ri: u re_ bilan boshlanishi kerak');
  return key;
}

function mergeEnv(content, apiKey) {
  const values = { ...SETTINGS, SMTP_PASS: validateApiKey(apiKey) };
  const seen = new Set();
  const output = [];
  for (const line of String(content || '').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)=/);
    const key = match?.[1];
    if (!key || !Object.prototype.hasOwnProperty.call(values, key)) {
      output.push(line);
      continue;
    }
    if (!seen.has(key)) output.push(`${key}=${values[key]}`);
    seen.add(key);
  }
  const missing = Object.keys(values).filter((key) => !seen.has(key));
  if (missing.length) {
    if (output.length && output[output.length - 1] !== '') output.push('');
    output.push('# Resend SMTP — ops/vps/set-resend-smtp.ps1 orqali boshqariladi');
    for (const key of missing) output.push(`${key}=${values[key]}`);
  }
  return `${output.join('\n').replace(/\n+$/, '')}\n`;
}

function configure(envPath, apiKey) {
  const target = path.resolve(envPath);
  const directory = path.dirname(target);
  if (!fs.existsSync(directory)) throw new Error(`ENV papkasi topilmadi: ${directory}`);
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error('Symlink ENV fayliga yozish rad etildi');

  const previous = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${target}.pre-resend-${stamp}`;
  if (fs.existsSync(target)) {
    fs.copyFileSync(target, backupPath);
    fs.chmodSync(backupPath, 0o600);
  }

  const tempPath = `${target}.resend-${process.pid}.tmp`;
  fs.writeFileSync(tempPath, mergeEnv(previous, apiKey), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  fs.renameSync(tempPath, target);
  fs.chmodSync(target, 0o600);
  return { target, backupPath: fs.existsSync(backupPath) ? backupPath : null, keys: [...Object.keys(SETTINGS), 'SMTP_PASS'] };
}

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const result = configure(process.env.RESEND_ENV_FILE || '/app/.env', Buffer.concat(chunks).toString('utf8'));
  process.stdout.write(`Resend SMTP sozlamalari saqlandi: ${result.keys.join(', ')}\n`);
  if (result.backupPath) process.stdout.write(`Oldingi ENV backup: ${result.backupPath}\n`);
}

if (require.main === module) main().catch((err) => { process.stderr.write(`${err.message}\n`); process.exit(1); });

module.exports = { configure, mergeEnv, validateApiKey };
