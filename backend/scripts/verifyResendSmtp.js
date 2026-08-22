require('dotenv').config({ path: process.env.RESEND_ENV_FILE || '/app/.env', override: true });
const nodemailer = require('nodemailer');

async function main() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE) === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.verify();
  process.stdout.write(`SMTP login muvaffaqiyatli: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}\n`);
}

main().catch((err) => { process.stderr.write(`SMTP tekshiruv xatosi: ${err.message}\n`); process.exit(1); });
