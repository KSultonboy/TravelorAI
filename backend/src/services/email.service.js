const nodemailer = require('nodemailer');
const { logger } = require('../config/logger');
const os = require('os');

const APP_NAME = process.env.APP_NAME || 'TravelorAI';
const MAIL_FROM = process.env.MAIL_FROM || `"${APP_NAME}" <no-reply@travelorai.local>`;
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || process.env.SMTP_USER || 'support@travelorai.local';
const SMTP_FALLBACK_DIRECT = String(process.env.SMTP_FALLBACK_DIRECT || 'false') === 'true';
const SMTP_ALLOW_INVALID_TLS = String(process.env.SMTP_ALLOW_INVALID_TLS || 'false') === 'true';
const SMTP_DIRECT_NAME = process.env.SMTP_DIRECT_NAME || os.hostname();

let transporterCache;
let transportModeCache = 'log';

function getTransporter() {
  if (typeof transporterCache !== 'undefined') {
    return { transporter: transporterCache, mode: transportModeCache };
  }

  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    transporterCache = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      // Hang'lardan himoya: SMTP sekin bo'lsa cheksiz kutib qolmasin.
      connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 10000),
      greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 10000),
      socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 20000),
      // Ulanishni qayta ishlatish — har email uchun yangi TLS handshake (sekin) qilmaslik.
      pool: true,
      maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS || 3),
      maxMessages: Number(process.env.SMTP_MAX_MESSAGES || 50),
      ...(SMTP_ALLOW_INVALID_TLS ? { tls: { rejectUnauthorized: false } } : {}),
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    });
    transportModeCache = 'smtp';
    return { transporter: transporterCache, mode: transportModeCache };
  }

  if (SMTP_FALLBACK_DIRECT) {
    transporterCache = nodemailer.createTransport({
      direct: true,
      name: SMTP_DIRECT_NAME,
    });
    transportModeCache = 'direct';
    return { transporter: transporterCache, mode: transportModeCache };
  }

  transporterCache = null;
  transportModeCache = 'log';
  return { transporter: transporterCache, mode: transportModeCache };
}

function buildHtml({ heading, intro, code, expiresInMinutes, footer }) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f4f7f5;padding:24px;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;border:1px solid #eaf0eb;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#1a6b3c;">${APP_NAME}</p>
        <h1 style="margin:0 0 12px;font-size:26px;color:#122117;">${heading}</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#4f6355;">${intro}</p>
        <div style="margin:24px 0;padding:18px 20px;border-radius:16px;background:#e7f5ec;text-align:center;">
          <div style="font-size:34px;letter-spacing:10px;font-weight:700;color:#1a6b3c;">${code}</div>
        </div>
        <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:#4f6355;">Kod ${expiresInMinutes} daqiqa ichida amal qiladi.</p>
        <p style="margin:0;font-size:13px;line-height:1.7;color:#7c8a81;">${footer}</p>
      </div>
    </div>
  `;
}

async function sendMail({ to, subject, html, text, logMeta }) {
  const { transporter, mode } = getTransporter();

  if (!transporter) {
    logger.info('Email transport fallback: logging auth message', { to, subject, ...logMeta });
    return {
      delivery: 'log',
      ...(process.env.NODE_ENV !== 'production' && logMeta?.code ? { devCode: logMeta.code } : {}),
    };
  }

  try {
    await transporter.sendMail({
      from: MAIL_FROM,
      to,
      subject,
      html,
      text,
    });
  } catch (err) {
    logger.error('Email send failed, fallback to log mode', {
      message: err.message,
      deliveryMode: mode,
      to,
      subject,
      ...logMeta,
    });
    return {
      delivery: 'log',
      ...(process.env.NODE_ENV !== 'production' && logMeta?.code ? { devCode: logMeta.code } : {}),
    };
  }

  return { delivery: mode };
}

async function sendVerificationCodeEmail({ email, name, code, expiresInMinutes }) {
  return sendMail({
    to: email,
    subject: `${APP_NAME} email tasdiqlash kodi`,
    html: buildHtml({
      heading: 'Email manzilingizni tasdiqlang',
      intro: `${name || 'Salom'}, ro'yxatdan o'tishni yakunlash uchun quyidagi kodni kiriting.`,
      code,
      expiresInMinutes,
      footer: "Agar bu so'rovni siz yubormagan bo'lsangiz, ushbu emailni e'tiborsiz qoldiring.",
    }),
    text: `Tasdiqlash kodi: ${code}. Kod ${expiresInMinutes} daqiqa amal qiladi.`,
    logMeta: { type: 'verification', code, email },
  });
}

async function sendEmailChangeCodeEmail({ email, name, code, expiresInMinutes, newEmail }) {
  return sendMail({
    to: email,
    subject: `${APP_NAME} email almashtirish kodi`,
    html: buildHtml({
      heading: 'Email manzilini almashtirish',
      intro: `${name || 'Salom'}, akkauntingiz emailini ${safeText(newEmail)} manziliga almashtirish uchun quyidagi kodni kiriting.`,
      code,
      expiresInMinutes,
      footer: "Agar bu so'rovni siz yubormagan bo'lsangiz, kodni hech kimga bermang va support bilan bog'laning.",
    }),
    text: `Email almashtirish kodi: ${code}. Yangi email: ${safeText(newEmail)}. Kod ${expiresInMinutes} daqiqa amal qiladi.`,
    logMeta: { type: 'agency_email_change', code, email, newEmail: safeText(newEmail) },
  });
}

// Email almashtirish YAKUNLANGANDA xabarnoma — eski va yangi manzilga (kodsiz)
async function sendEmailChangedNoticeEmail({ oldEmail, newEmail }) {
  const html = `
    <div style="font-family:Arial,sans-serif;background:#f4f7f5;padding:24px;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;border:1px solid #eaf0eb;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#1a6b3c;">${APP_NAME}</p>
        <h1 style="margin:0 0 12px;font-size:24px;color:#122117;">Email muvaffaqiyatli o'zgartirildi ✅</h1>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#4f6355;">
          Agency akkauntingiz login emaili <b>${safeText(oldEmail)}</b> dan <b>${safeText(newEmail)}</b> ga almashtirildi.
          Endi tizimga yangi email bilan kirasiz.
        </p>
        <p style="margin:0 0 10px;font-size:13px;line-height:1.7;color:#7c8a81;">
          Eslatma: Google orqali kirish eski hisobdan uzildi — Google bilan kirish uchun endi yangi emailingizdagi Google akkauntdan foydalaning.
        </p>
        <p style="margin:0;font-size:13px;line-height:1.7;color:#7c8a81;">
          Agar bu o'zgarishni siz qilmagan bo'lsangiz, darhol support bilan bog'laning: ${SUPPORT_EMAIL}
        </p>
      </div>
    </div>
  `;
  const text = `Agency login emailingiz ${safeText(oldEmail)} dan ${safeText(newEmail)} ga almashtirildi. Bu siz bo'lmasangiz: ${SUPPORT_EMAIL}`;
  const results = await Promise.allSettled([
    sendMail({ to: newEmail, subject: `${APP_NAME} — email o'zgartirildi`, html, text, logMeta: { type: 'agency_email_changed_notice', email: newEmail } }),
    sendMail({ to: oldEmail, subject: `${APP_NAME} — email o'zgartirildi`, html, text, logMeta: { type: 'agency_email_changed_notice', email: oldEmail } }),
  ]);
  return results;
}

async function sendPasswordResetCodeEmail({ email, name, code, expiresInMinutes }) {
  return sendMail({
    to: email,
    subject: `${APP_NAME} parol tiklash kodi`,
    html: buildHtml({
      heading: 'Parolni yangilash',
      intro: `${name || 'Salom'}, parolni tiklash uchun quyidagi koddan foydalaning.`,
      code,
      expiresInMinutes,
      footer: "Agar siz parol tiklash so'rovini yubormagan bo'lsangiz, akkauntingiz xavfsiz qoladi.",
    }),
    text: `Parol tiklash kodi: ${code}. Kod ${expiresInMinutes} daqiqa amal qiladi.`,
    logMeta: { type: 'password_reset', code, email },
  });
}

async function sendAccountDeleteCodeEmail({ email, name, code, expiresInMinutes }) {
  return sendMail({
    to: email,
    subject: `${APP_NAME} hisobni o'chirish kodi`,
    html: buildHtml({
      heading: "Hisobni o'chirishni tasdiqlang",
      intro: `${name || 'Salom'}, akkauntingizni butunlay o'chirish uchun quyidagi kodni kiriting.`,
      code,
      expiresInMinutes,
      footer: "Agar bu so'rovni siz yubormagan bo'lsangiz, kodni hech kimga bermang va support bilan bog'laning.",
    }),
    text: `Hisobni o'chirish kodi: ${code}. Kod ${expiresInMinutes} daqiqa amal qiladi.`,
    logMeta: { type: 'account_delete', code, email },
  });
}

function safeText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').trim();
}

async function sendSupportFeedbackEmail({
  userId,
  userName,
  userEmail,
  category,
  subject,
  message,
  contactEmail,
  platform,
  appVersion,
}) {
  const safeCategory = safeText(category || 'other') || 'other';
  const safeSubject = safeText(subject || '') || '(no title)';
  const safeMessage = safeText(message || '');
  const safeContactEmail = safeText(contactEmail || '');
  const safeUserEmail = safeText(userEmail || '');
  const safeUserName = safeText(userName || '');
  const safePlatform = safeText(platform || '');
  const safeVersion = safeText(appVersion || '');

  const emailSubject = `[${APP_NAME} Feedback] ${safeCategory.toUpperCase()} - ${safeSubject}`;
  const html = `
    <div style="font-family:Arial,sans-serif;background:#f4f7f5;padding:24px;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #eaf0eb;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#1a6b3c;">${APP_NAME}</p>
        <h1 style="margin:0 0 10px;font-size:22px;color:#122117;">New user feedback</h1>
        <p style="margin:0 0 14px;font-size:14px;color:#4f6355;">Category: <strong>${safeCategory}</strong></p>
        <p style="margin:0 0 18px;font-size:14px;color:#4f6355;">Title: <strong>${safeSubject}</strong></p>
        <div style="padding:14px;border-radius:12px;background:#f7faf8;border:1px solid #eaf0eb;margin-bottom:18px;">
          <p style="margin:0;font-size:14px;line-height:1.7;color:#1c2b22;white-space:pre-wrap;">${safeMessage}</p>
        </div>
        <h2 style="margin:0 0 8px;font-size:15px;color:#1a6b3c;">User context</h2>
        <ul style="margin:0;padding-left:18px;color:#2f4136;font-size:13px;line-height:1.6;">
          <li>User ID: ${safeText(String(userId || 'unknown'))}</li>
          <li>Name: ${safeUserName || '-'}</li>
          <li>Account email: ${safeUserEmail || '-'}</li>
          <li>Contact email: ${safeContactEmail || '-'}</li>
          <li>Platform: ${safePlatform || '-'}</li>
          <li>App version: ${safeVersion || '-'}</li>
        </ul>
      </div>
    </div>
  `;

  const text = [
    `${APP_NAME} user feedback`,
    `Category: ${safeCategory}`,
    `Title: ${safeSubject}`,
    '',
    safeMessage,
    '',
    `User ID: ${String(userId || 'unknown')}`,
    `Name: ${safeUserName || '-'}`,
    `Account email: ${safeUserEmail || '-'}`,
    `Contact email: ${safeContactEmail || '-'}`,
    `Platform: ${safePlatform || '-'}`,
    `App version: ${safeVersion || '-'}`,
  ].join('\n');

  return sendMail({
    to: SUPPORT_EMAIL,
    subject: emailSubject,
    html,
    text,
    logMeta: {
      type: 'user_feedback',
      userId,
      userEmail: safeUserEmail || undefined,
      category: safeCategory,
    },
  });
}

async function sendBookingLeadEmail({ to, agencyName, tourTitle, customerName, customerPhone, customerEmail, travelers, travelDate, message }) {
  if (!to) return { delivery: 'skipped' };
  const t = (v) => safeText(String(v ?? '')).trim() || '-';
  const subject = `[${APP_NAME}] Yangi so'rov: ${t(tourTitle)}`;
  const html = `
    <div style="font-family:Arial,sans-serif;background:#f4f7f5;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #eaf0eb;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#2d9cdb;">${APP_NAME}</p>
        <h1 style="margin:0 0 6px;font-size:22px;color:#122117;">Yangi sayohat so'rovi</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#4f6355;">${t(agencyName)} — <strong>${t(tourTitle)}</strong> turi bo'yicha yangi so'rov keldi.</p>
        <div style="padding:14px;border-radius:12px;background:#f7faf8;border:1px solid #eaf0eb;">
          <ul style="margin:0;padding-left:18px;color:#2f4136;font-size:14px;line-height:1.7;">
            <li>Mijoz: <strong>${t(customerName)}</strong></li>
            <li>Telefon: <strong>${t(customerPhone)}</strong></li>
            <li>Email: ${t(customerEmail)}</li>
            <li>Kishi soni: ${t(travelers)}</li>
            <li>Sayohat sanasi: ${t(travelDate)}</li>
          </ul>
          ${message ? `<p style="margin:12px 0 0;font-size:14px;color:#1c2b22;white-space:pre-wrap;">"${safeText(message)}"</p>` : ''}
        </div>
        <p style="margin:18px 0 0;font-size:13px;color:#6f7b74;">Mijoz bilan telefon yoki Telegram orqali bog'laning. Portal: agency.travelorai.com</p>
      </div>
    </div>
  `;
  const text = [
    `${APP_NAME} — yangi so'rov`,
    `Tur: ${t(tourTitle)} (${t(agencyName)})`,
    '',
    `Mijoz: ${t(customerName)}`,
    `Telefon: ${t(customerPhone)}`,
    `Email: ${t(customerEmail)}`,
    `Kishi: ${t(travelers)}`,
    `Sana: ${t(travelDate)}`,
    message ? `\nXabar: ${safeText(message)}` : '',
  ].join('\n');

  return sendMail({ to, subject, html, text, logMeta: { type: 'booking_lead', to } });
}

module.exports = {
  sendVerificationCodeEmail,
  sendEmailChangeCodeEmail,
  sendEmailChangedNoticeEmail,
  sendPasswordResetCodeEmail,
  sendAccountDeleteCodeEmail,
  sendSupportFeedbackEmail,
  sendBookingLeadEmail,
};
