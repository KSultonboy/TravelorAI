const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { loggerMiddleware } = require('./src/middleware/logger.middleware');
const { rateLimiter } = require('./src/middleware/rateLimit.middleware');
const routes = require('./src/routes/index');

const app = express();
const APP_NAME = process.env.APP_NAME || 'TravelorAI';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'komiljonovsultonboy954@gmail.com';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderAccountDeletionPage() {
  const appName = escapeHtml(APP_NAME);
  const supportEmail = escapeHtml(SUPPORT_EMAIL);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex,nofollow" />
    <title>${appName} Account Deletion</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f7f5;
        --card: #ffffff;
        --text: #122117;
        --muted: #5d6b63;
        --primary: #1a6b3c;
        --border: #dfe8e2;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        background: var(--bg);
        color: var(--text);
        line-height: 1.6;
      }
      .wrap {
        max-width: 860px;
        margin: 0 auto;
        padding: 24px;
      }
      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 24px;
        box-shadow: 0 6px 18px rgba(16, 31, 22, 0.06);
      }
      h1 { margin: 0 0 10px; font-size: 30px; }
      h2 { margin: 24px 0 10px; font-size: 19px; color: var(--primary); }
      p { margin: 8px 0; color: var(--muted); }
      ol, ul { margin: 8px 0 0 20px; color: var(--text); }
      li { margin: 6px 0; }
      code {
        background: #eef5f0;
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 2px 6px;
      }
      .note {
        margin-top: 16px;
        padding: 14px;
        border-radius: 12px;
        border: 1px solid #d7e8dc;
        background: #f0f8f3;
      }
      .footer {
        margin-top: 24px;
        font-size: 13px;
        color: #6f7b74;
      }
      a { color: var(--primary); text-decoration: none; }
      a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="card">
        <h1>${appName} Account Deletion</h1>
        <p>
          This page explains how users can request account deletion for ${appName}, what data is deleted,
          and what limited technical data may be retained for a short period.
        </p>

        <h2>How to delete your account in the app</h2>
        <ol>
          <li>Open <code>Profile</code>.</li>
          <li>Tap <code>Delete account</code>.</li>
          <li>Confirm deletion. For local accounts, enter your password.</li>
        </ol>

        <h2>If you cannot access the app</h2>
        <p>
          Send a deletion request to
          <a href="mailto:${supportEmail}?subject=TravelorAI%20Account%20Deletion%20Request">${supportEmail}</a>
          from your account email address.
        </p>
        <p>Please include:</p>
        <ul>
          <li>Your account email used in ${appName}</li>
          <li>Subject: <code>TravelorAI Account Deletion Request</code></li>
        </ul>

        <h2>Data deleted when account is deleted</h2>
        <ul>
          <li>Profile data (name, bio, avatar, email-linked account record)</li>
          <li>Trips and itinerary data</li>
          <li>Wishlist and travel preference data</li>
          <li>Email verification/password reset codes related to the account</li>
        </ul>

        <h2>Data retention</h2>
        <ul>
          <li>Primary account and trip data are deleted immediately after confirmation.</li>
          <li>Limited security/technical server logs may be retained for up to 30 days.</li>
        </ul>

        <div class="note">
          Need help? Contact:
          <a href="mailto:${supportEmail}">${supportEmail}</a>
        </div>

        <p class="footer">Last updated: ${new Date().toISOString().slice(0, 10)}</p>
      </section>
    </main>
  </body>
</html>`;
}

function renderPrivacyPolicyPage(baseUrl) {
  const appName = escapeHtml(APP_NAME);
  const supportEmail = escapeHtml(SUPPORT_EMAIL);
  const safeBaseUrl = escapeHtml(baseUrl || '');
  const deletionUrl = safeBaseUrl ? `${safeBaseUrl}/account-deletion` : '/account-deletion';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex,nofollow" />
    <title>${appName} Privacy Policy</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f7f5;
        --card: #ffffff;
        --text: #122117;
        --muted: #5d6b63;
        --primary: #1a6b3c;
        --border: #dfe8e2;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        background: var(--bg);
        color: var(--text);
        line-height: 1.6;
      }
      .wrap {
        max-width: 920px;
        margin: 0 auto;
        padding: 24px;
      }
      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 24px;
        box-shadow: 0 6px 18px rgba(16, 31, 22, 0.06);
      }
      h1 { margin: 0 0 10px; font-size: 30px; }
      h2 { margin: 24px 0 10px; font-size: 19px; color: var(--primary); }
      p { margin: 8px 0; color: var(--muted); }
      ul { margin: 8px 0 0 20px; color: var(--text); }
      li { margin: 6px 0; }
      code {
        background: #eef5f0;
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 2px 6px;
      }
      .note {
        margin-top: 16px;
        padding: 14px;
        border-radius: 12px;
        border: 1px solid #d7e8dc;
        background: #f0f8f3;
      }
      .footer {
        margin-top: 24px;
        font-size: 13px;
        color: #6f7b74;
      }
      a { color: var(--primary); text-decoration: none; }
      a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="card">
        <h1>${appName} Privacy Policy</h1>
        <p>
          This Privacy Policy explains how ${appName} collects, uses, stores, and protects user data.
          By using ${appName}, you agree to this policy.
        </p>

        <h2>Data we collect</h2>
        <ul>
          <li><strong>Personal info:</strong> name, email address, user ID</li>
          <li><strong>Location:</strong> approximate and precise location (only when user grants permission)</li>
          <li><strong>Photos:</strong> profile avatar image selected by user</li>
          <li><strong>App activity:</strong> user-generated trip content and notes</li>
          <li><strong>Financial info:</strong> travel budget and trip cost values entered/generated in app</li>
        </ul>

        <h2>How we use data</h2>
        <ul>
          <li>Provide core app functionality (auth, planner, map, trips, profile)</li>
          <li>Manage user accounts and preferences</li>
          <li>Show personalized travel planning results</li>
          <li>Send account-related communication (verification and password reset emails)</li>
        </ul>

        <h2>Data sharing</h2>
        <p>
          ${appName} does <strong>not</strong> share personal data with third parties for advertising or data brokerage.
        </p>

        <h2>Data security</h2>
        <ul>
          <li>Data is encrypted in transit (HTTPS/TLS).</li>
          <li>Access to backend systems is restricted.</li>
          <li>We apply operational controls to reduce unauthorized access risks.</li>
        </ul>

        <h2>Data retention</h2>
        <ul>
          <li>Account and trip data are retained while the account is active.</li>
          <li>When account deletion is requested, associated account data is deleted.</li>
          <li>Limited technical/security logs may be retained for up to 30 days.</li>
        </ul>

        <h2>Account deletion</h2>
        <p>
          Users can delete account data in-app via <code>Profile -> Delete account</code> or by using this page:
          <a href="${deletionUrl}">${deletionUrl}</a>
        </p>

        <h2>Contact</h2>
        <p>
          If you have privacy questions, contact us at
          <a href="mailto:${supportEmail}">${supportEmail}</a>.
        </p>

        <div class="note">
          Policy scope: this policy applies to the mobile application and backend services of ${appName}.
        </div>

        <p class="footer">Last updated: ${new Date().toISOString().slice(0, 10)}</p>
      </section>
    </main>
  </body>
</html>`;
}

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  fallthrough: false,
  maxAge: process.env.NODE_ENV === 'production' ? '30d' : 0,
}));
app.use(express.json({
  limit: '16mb',
  // Instagram webhook imzosi (X-Hub-Signature-256) XOM body ustidan hisoblanadi.
  // JSON.parse qilib qayta yig'ilgan matn imzoga mos kelmaydi (kalitlar tartibi
  // va probellar farq qiladi), shuning uchun faqat o'sha yo'l uchun xom nusxani
  // saqlab qo'yamiz — boshqa marshrutlar uchun ortiqcha xotira ishlatmaymiz.
  verify: (req, _res, buf) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api/v1/instagram/webhook')) {
      req.rawBody = buf;
    }
  },
}));
app.use(loggerMiddleware);

app.get(['/account-deletion', '/delete-account'], (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(renderAccountDeletionPage());
});

app.get(['/privacy-policy', '/privacy'], (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers.host || '';
  const baseUrl = host ? `${protocol}://${host}` : '';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(renderPrivacyPolicyPage(baseUrl));
});

// CLICK to'lov callback'lari — rateLimiter'DAN OLDIN va o'z body-parser'i bilan.
// CLICK `application/x-www-form-urlencoded` yuboradi (global parser faqat JSON),
// hamda to'lov tasdig'i so'rov limitiga urilib qolmasligi kerak.
app.use(
  '/api/v1/payments/click',
  express.urlencoded({ extended: false }),
  require('./src/routes/clickPublic.routes')
);

// Instagram callback + webhook — rateLimiter'DAN OLDIN. Meta bir vaqtda ko'p
// xabar yuborishi mumkin; limitga urilsa u qayta-qayta uradi va oxirida
// obunani o'chirib qo'yadi. Ikkalasi ham o'z imzosi bilan himoyalangan.
app.use('/api/v1/instagram', require('./src/routes/instagram.routes'));

app.use('/api/v1', rateLimiter, routes);

app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ success: false, message: err.message || 'Internal Server Error' });
});

module.exports = app;
