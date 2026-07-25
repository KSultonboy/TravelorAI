// Lidga biriktirilgan fayllar (pasport / viza / shartnoma skani).
// Fayl DB'da (bytea) saqlanadi — PII, ochiq /uploads statik yo'lida EMAS.
// Faqat egasi (autentifikatsiyalangan agentlik) ko'radi va yuklab oladi.
const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { ensureApprovedAgency } = require('./agency.controller');

const MAX_FILE_BYTES = 6 * 1024 * 1024; // 6 MB
const MAX_FILES_PER_LEAD = 15;
const ALLOWED = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

// data:<mime>;base64,<...> ni ajratadi
function parseDataUrl(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([a-z0-9.+/-]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!m) return null;
  return { mime: m[1].toLowerCase(), buffer: Buffer.from(m[2].replace(/\s/g, ''), 'base64') };
}

function ownedBooking(agencyId, bookingId) {
  return prisma.tourBooking.findFirst({ where: { id: bookingId, agencyId } });
}

// GET /bookings/:id/files — metadata ro'yxati (fayl mazmunisiz)
async function listFiles(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    const booking = await ownedBooking(agency.id, req.params.id);
    if (!booking) return error(res, 'Lid topilmadi', 404);
    const files = await prisma.leadFile.findMany({
      where: { bookingId: booking.id, agencyId: agency.id },
      select: { id: true, name: true, mimeType: true, size: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return success(res, { files });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

// POST /bookings/:id/files — { name, dataUrl }
async function uploadFile(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    const booking = await ownedBooking(agency.id, req.params.id);
    if (!booking) return error(res, 'Lid topilmadi', 404);

    const count = await prisma.leadFile.count({ where: { bookingId: booking.id } });
    if (count >= MAX_FILES_PER_LEAD) return error(res, `Bir lidga ko'pi bilan ${MAX_FILES_PER_LEAD} ta fayl`, 400);

    const parsed = parseDataUrl(req.body && req.body.dataUrl);
    if (!parsed) return error(res, 'Fayl formati noto\'g\'ri', 400);
    const ext = ALLOWED[parsed.mime];
    if (!ext) return error(res, 'Faqat JPG, PNG, WEBP yoki PDF qabul qilinadi', 400);
    if (!parsed.buffer.length || parsed.buffer.length > MAX_FILE_BYTES) {
      return error(res, 'Fayl hajmi 6 MB dan oshmasligi kerak', 400);
    }
    const rawName = String((req.body && req.body.name) || '').replace(/[\r\n]/g, '').trim().slice(0, 120);
    const created = await prisma.leadFile.create({
      data: {
        agencyId: agency.id,
        bookingId: booking.id,
        name: rawName || `hujjat.${ext}`,
        mimeType: parsed.mime,
        size: parsed.buffer.length,
        data: parsed.buffer,
      },
      select: { id: true, name: true, mimeType: true, size: true, createdAt: true },
    });
    return success(res, { file: created });
  } catch (err) {
    return error(res, err.message, 400);
  }
}

// GET /files/:id — auth-gated; base64 dataUrl qaytaradi (ochish / yuklab olish uchun)
async function downloadFile(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    const file = await prisma.leadFile.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!file) return error(res, 'Fayl topilmadi', 404);
    const dataUrl = `data:${file.mimeType};base64,${Buffer.from(file.data).toString('base64')}`;
    return success(res, { file: { id: file.id, name: file.name, mimeType: file.mimeType, size: file.size, dataUrl } });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

// DELETE /files/:id
async function deleteFile(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    const file = await prisma.leadFile.findFirst({ where: { id: req.params.id, agencyId: agency.id }, select: { id: true } });
    if (!file) return error(res, 'Fayl topilmadi', 404);
    await prisma.leadFile.delete({ where: { id: file.id } });
    return success(res, { deleted: true, id: file.id });
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = { listFiles, uploadFile, downloadFile, deleteFile };
