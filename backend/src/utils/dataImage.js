const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

async function materializeDataImage(value, folder = 'agency') {
  const text = String(value || '').trim();
  if (!text.startsWith('data:image/')) return text;

  const match = text.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([a-z0-9+/=\s]+)$/i);
  if (!match) throw new Error('Rasm formati noto‘g‘ri');

  const mime = match[1].toLowerCase();
  const extension = IMAGE_TYPES[mime];
  if (!extension) throw new Error('Faqat JPG, PNG, WEBP yoki GIF rasm qabul qilinadi');

  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Rasm hajmi 8 MB dan oshmasligi kerak');
  }

  const safeFolder = String(folder || 'agency').replace(/[^a-z0-9_-]/gi, '') || 'agency';
  const uploadDir = path.resolve(__dirname, '../../uploads', safeFolder);
  await fs.mkdir(uploadDir, { recursive: true });

  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
  await fs.writeFile(path.join(uploadDir, filename), buffer);
  return `/uploads/${safeFolder}/${filename}`;
}

module.exports = { materializeDataImage };
