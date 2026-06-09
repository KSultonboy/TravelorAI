const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function hasValidSignature(buffer, mime) {
  if (mime === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === 'image/png') {
    return buffer.length >= 8
      && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mime === 'image/gif') {
    const header = buffer.subarray(0, 6).toString('ascii');
    return header === 'GIF87a' || header === 'GIF89a';
  }
  if (mime === 'image/webp') {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

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
    throw new Error('Rasm hajmi 5 MB dan oshmasligi kerak');
  }
  if (!hasValidSignature(buffer, mime)) {
    throw new Error('Rasm tarkibi tanlangan formatga mos emas');
  }

  const safeFolder = String(folder || 'agency').replace(/[^a-z0-9_-]/gi, '') || 'agency';
  const uploadDir = path.resolve(__dirname, '../../uploads', safeFolder);
  await fs.mkdir(uploadDir, { recursive: true });

  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
  await fs.writeFile(path.join(uploadDir, filename), buffer);
  return `/uploads/${safeFolder}/${filename}`;
}

async function deleteMaterializedImage(value, folder = 'agency') {
  const safeFolder = String(folder || 'agency').replace(/[^a-z0-9_-]/gi, '') || 'agency';
  const text = String(value || '').trim();
  const match = text.match(new RegExp(`^/uploads/${safeFolder}/([a-z0-9._-]+)$`, 'i'));
  if (!match) return false;

  const uploadDir = path.resolve(__dirname, '../../uploads', safeFolder);
  const filePath = path.resolve(uploadDir, match[1]);
  if (!filePath.startsWith(`${uploadDir}${path.sep}`)) return false;

  try {
    await fs.unlink(filePath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

module.exports = { materializeDataImage, deleteMaterializedImage, hasValidSignature };
