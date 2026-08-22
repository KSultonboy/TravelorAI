const fs = require('fs');
const { createRequire } = require('module');
const appRequire = fs.existsSync('/app/package.json') ? createRequire('/app/package.json') : require;
const nodemailer = appRequire('nodemailer');

function loadEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

async function main() {
  loadEnvFile(process.env.RESEND_ENV_FILE || '/app/.env');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE) === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.verify();
  process.stdout.write(`SMTP login muvaffaqiyatli: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}\n`);
}

if (require.main === module) main().catch((err) => { process.stderr.write(`SMTP tekshiruv xatosi: ${err.message}\n`); process.exit(1); });

module.exports = { loadEnvFile };
