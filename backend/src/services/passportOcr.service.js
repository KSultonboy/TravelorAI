const { recognize } = require('tesseract.js');
const eng = require('@tesseract.js-data/eng');

function cleanMrzLine(value) {
  return String(value || '').toUpperCase().replace(/\s+/g, '<').replace(/[^A-Z0-9<]/g, '').replace(/<{3,}/g, (run) => run);
}

function mrzDate(value, kind) {
  if (!/^\d{6}$/.test(value)) return null;
  const yy = Number(value.slice(0, 2)); const mm = value.slice(2, 4); const dd = value.slice(4, 6);
  const nowYY = new Date().getUTCFullYear() % 100;
  const year = kind === 'birth' ? (yy > nowYY ? 1900 + yy : 2000 + yy) : 2000 + yy;
  const iso = `${year}-${mm}-${dd}`;
  return Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) ? null : iso;
}

function parsePassportMrz(text, confidence = null) {
  const lines = String(text || '').split(/\r?\n/).map(cleanMrzLine).filter((line) => line.length >= 38);
  let firstIndex = lines.findIndex((line) => /^P</.test(line));
  if (firstIndex < 0) firstIndex = lines.findIndex((line) => /^P[A-Z0-9<]/.test(line));
  if (firstIndex < 0 || !lines[firstIndex + 1]) return null;
  const line1 = lines[firstIndex].padEnd(44, '<').slice(0, 44);
  const line2 = lines[firstIndex + 1].padEnd(44, '<').slice(0, 44);
  const names = line1.slice(5).split('<<');
  const surname = (names[0] || '').replace(/</g, ' ').trim() || null;
  const givenNames = (names.slice(1).join(' ') || '').replace(/</g, ' ').replace(/\s+/g, ' ').trim() || null;
  return {
    documentType: 'passport', countryCode: line1.slice(2, 5).replace(/</g, '') || null,
    passportNumber: line2.slice(0, 9).replace(/</g, '') || null,
    surname, givenNames, nationality: line2.slice(10, 13).replace(/</g, '') || null,
    birthDate: mrzDate(line2.slice(13, 19), 'birth'), sex: line2.slice(20, 21).replace(/</g, '') || null,
    issueDate: null, expiryDate: mrzDate(line2.slice(21, 27), 'expiry'),
    personalNumber: line2.slice(28, 42).replace(/</g, '') || null,
    mrz: `${line1}\n${line2}`, confidence: confidence == null ? null : Math.max(0, Math.min(1, Number(confidence) / 100)),
    warnings: [], engine: 'tesseract-local',
  };
}

async function extractPassportLocal(buffer) {
  const result = await recognize(buffer, eng.code, { langPath: eng.langPath, gzip: eng.gzip, logger: () => {} });
  const parsed = parsePassportMrz(result.data?.text || '', result.data?.confidence);
  if (!parsed) {
    const err = new Error('Pasport MRZ satri topilmadi. Rasmni tekis, yorug‘ va pastdagi ikki satr to‘liq ko‘rinadigan qilib yuklang.');
    err.code = 'MRZ_NOT_FOUND';
    throw err;
  }
  return parsed;
}

module.exports = { cleanMrzLine, extractPassportLocal, mrzDate, parsePassportMrz };
