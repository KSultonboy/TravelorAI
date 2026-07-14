const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { issueAuthCode, AuthCodeType } = require('../services/auth.service');
const { adminReviewSchema } = require('../schemas/agency.schema');
const { bookingStatusSchema } = require('../schemas/booking.schema');
const { formatBooking } = require('./bookings.controller');
const { resolveTourImageUrl } = require('../utils/tourImage');
const { sendPushNotification } = require('../services/push.service');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[ʻ'\u2018\u2019\u02BB]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

function normalizeTourBadge(value) {
  return String(value || '').trim().toLowerCase() === 'popular' ? 'Popular' : 'Latest';
}

async function uniqueSlug(base) {
  const safe = base || ('poi-' + Date.now());
  let slug = safe;
  let i = 1;
  while (await prisma.poi.findFirst({ where: { slug } })) {
    slug = safe + '-' + i++;
  }
  return slug;
}

async function uniqueHeroSlideSlug(base, currentId) {
  const safe = base || ('hero-' + Date.now());
  let slug = safe;
  let i = 1;

  while (
    await prisma.homeHeroSlide.findFirst({
      where: {
        slug,
        ...(currentId ? { NOT: { id: currentId } } : {}),
      },
    })
  ) {
    slug = safe + '-' + i++;
  }

  return slug;
}

async function uniqueAgencySlug(base, currentId) {
  const safe = base || ('agency-' + Date.now());
  let slug = safe;
  let i = 1;

  while (
    await prisma.tourAgency.findFirst({
      where: {
        slug,
        ...(currentId ? { NOT: { id: currentId } } : {}),
      },
    })
  ) {
    slug = safe + '-' + i++;
  }

  return slug;
}

async function uniqueStorySlug(base, currentId) {
  const safe = base || ('story-' + Date.now());
  let slug = safe;
  let i = 1;

  while (
    await prisma.travelerStory.findFirst({
      where: {
        slug,
        ...(currentId ? { NOT: { id: currentId } } : {}),
      },
    })
  ) {
    slug = safe + '-' + i++;
  }

  return slug;
}

const TYPE_ICON = { landmark: '🏛️', hotel: '🏨', restaurant: '🍽️', transport: '🚌' };

// DB type → Uzbek category key (for frontend CategoryPieChart)
const TYPE_TO_CATEGORY = { landmark: 'tarixiy', hotel: 'mehmonxona', restaurant: 'restoran', transport: 'transport' };
// Uzbek category key → DB type (for create/update from form)
const CATEGORY_TO_TYPE = { tarixiy: 'landmark', mehmonxona: 'hotel', restoran: 'restaurant', transport: 'transport', tabiiy: 'landmark', madaniy: 'landmark', bino: 'landmark' };

function normalizeJsonArray(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function getStats(req, res) {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [totalPlaces, totalUsers, totalTrips, totalFeedback, lowConfidence, mediumConfidence, highConfidence, missingSource, missingVerification, staleVerification, topCities] = await Promise.all([
      prisma.poi.count(),
      prisma.user.count(),
      prisma.trip.count(),
      prisma.feedback.count(),
      prisma.poi.count({ where: { confidenceScore: { lt: 0.6 } } }),
      prisma.poi.count({ where: { confidenceScore: { gte: 0.6, lt: 0.8 } } }),
      prisma.poi.count({ where: { confidenceScore: { gte: 0.8 } } }),
      prisma.poi.count({ where: { OR: [{ source: '' }, { sourceUrl: null }] } }),
      prisma.poi.count({ where: { lastVerifiedAt: null } }),
      prisma.poi.count({ where: { OR: [{ lastVerifiedAt: null }, { lastVerifiedAt: { lt: ninetyDaysAgo } }] } }),
      prisma.poi.groupBy({ by: ['city'], _count: { _all: true } }),
    ]);

    // Last 6 months POI creations aggregated by month
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const recentPois = await prisma.poi.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    });

    const monthMap = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleString('uz-UZ', { month: 'short', year: '2-digit' });
      monthMap[key] = 0;
    }
    recentPois.forEach((p) => {
      const key = new Date(p.createdAt).toLocaleString('uz-UZ', { month: 'short', year: '2-digit' });
      if (key in monthMap) monthMap[key]++;
    });
    const byMonth = Object.entries(monthMap).map(([month, count]) => ({ month, count }));

    // POI by category — return as Record<string, number> for CategoryPieChart
    const typeGroups = await prisma.poi.groupBy({ by: ['type'], _count: { _all: true } });
    const byCategory = {};
    typeGroups.forEach((g) => {
      const cat = TYPE_TO_CATEGORY[g.type] || g.type;
      byCategory[cat] = (byCategory[cat] || 0) + g._count._all;
    });

    return success(res, {
      totalPlaces,
      totalUsers,
      totalTrips,
      totalFeedback,
      byMonth,
      byCategory,
      quality: {
        lowConfidence,
        mediumConfidence,
        highConfidence,
        missingSource,
        missingVerification,
        staleVerification,
      },
      topCities: topCities
        .map((item) => ({ city: item.city, count: item._count._all }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

// ── Users ─────────────────────────────────────────────────────────────────────

async function getUsers(req, res) {
  try {
    const { search, page = '1', limit = '20' } = req.query;
    const parsedPage = Math.max(1, parseInt(String(page), 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));

    const where = search
      ? {
          OR: [
            { name: { contains: String(search), mode: 'insensitive' } },
            { email: { contains: String(search), mode: 'insensitive' } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, name: true, lastName: true, email: true, avatarUrl: true,
          blocked: true, createdAt: true, _count: { select: { trips: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parsedPage - 1) * parsedLimit,
        take: parsedLimit,
      }),
      prisma.user.count({ where }),
    ]);

    const items = users.map((u) => ({
      ...u,
      tripCount: u._count.trips,
      status: u.blocked ? 'blocked' : 'active',
    }));

    return success(res, { items, total, page: parsedPage, limit: parsedLimit });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function getUser(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        trips: { orderBy: { createdAt: 'desc' }, take: 5 },
        preference: true,
        _count: { select: { trips: true, wishlistItems: true, feedback: true } },
      },
    });
    if (!user) return error(res, 'Foydalanuvchi topilmadi', 404);
    return success(res, {
      ...user,
      tripCount: user._count.trips,
      status: user.blocked ? 'blocked' : 'active',
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function blockUser(req, res) {
  try {
    const { blocked } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { blocked: Boolean(blocked) },
      select: { id: true, name: true, email: true, blocked: true },
    });
    return success(res, { ...user, status: user.blocked ? 'blocked' : 'active' });
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Foydalanuvchi topilmadi', 404);
    return error(res, err.message, 500);
  }
}

async function deleteUser(req, res) {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    return success(res, { id: req.params.id });
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Foydalanuvchi topilmadi', 404);
    return error(res, err.message, 500);
  }
}

// Admin-triggered password reset: sends a reset CODE to the user's own email.
// The admin never sees or sets the password — the user completes the reset
// themselves via the standard /auth/reset-password flow. Also lifts any active
// login lockout so a locked-out user helped by support can get straight back in.
async function sendUserPasswordReset(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return error(res, 'Foydalanuvchi topilmadi', 404);
    if (!user.password) {
      return error(res, 'Bu akkaunt Google orqali yaratilgan — parol tiklash mavjud emas.', 400, {
        authProvider: 'google',
      });
    }

    const result = await issueAuthCode({ user, type: AuthCodeType.PASSWORD_RESET });

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockoutLevel: 0, lockoutUntil: null, lastFailedLoginAt: null },
    });

    return success(res, {
      message: `Parol tiklash kodi ${user.email} manziliga yuborildi.`,
      email: user.email,
      delivery: result.delivery,
      ...(result.devCode ? { devCode: result.devCode } : {}),
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

// ── Trips ─────────────────────────────────────────────────────────────────────

async function getTrips(req, res) {
  try {
    const { search, style, page = '1', limit = '20' } = req.query;
    const parsedPage = Math.max(1, parseInt(String(page), 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));

    const where = {};
    if (style) where.style = String(style);
    if (search) {
      where.OR = [
        { title: { contains: String(search), mode: 'insensitive' } },
        { user: { name: { contains: String(search), mode: 'insensitive' } } },
      ];
    }

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (parsedPage - 1) * parsedLimit,
        take: parsedLimit,
      }),
      prisma.trip.count({ where }),
    ]);

    const items = trips.map((t) => ({
      id: t.id,
      title: t.title,
      userId: t.userId,
      userName: t.user?.name || '',
      style: t.style,
      budget: t.totalCost,
      days: t.duration,
      destinations: Array.isArray(t.planData?.destinations) ? t.planData.destinations : [],
      createdAt: t.createdAt,
    }));

    return success(res, { items, total, page: parsedPage, limit: parsedLimit });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function getTrip(req, res) {
  try {
    const trip = await prisma.trip.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!trip) return error(res, 'Trip topilmadi', 404);
    return success(res, {
      ...trip,
      userName: trip.user?.name || '',
      budget: trip.totalCost,
      days: trip.duration,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function deleteTrip(req, res) {
  try {
    await prisma.trip.delete({ where: { id: req.params.id } });
    return success(res, { id: req.params.id });
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Trip topilmadi', 404);
    return error(res, err.message, 500);
  }
}

// ── Places (POI) ──────────────────────────────────────────────────────────────

async function getPlaces(req, res) {
  try {
    const { type, city, search, page = '1', limit = '20' } = req.query;
    const parsedPage = Math.max(1, parseInt(String(page), 10) || 1);
    const parsedLimit = Math.min(300, Math.max(1, parseInt(String(limit), 10) || 20));

    const where = {};
    if (type) where.type = String(type);
    if (city) where.city = { equals: String(city), mode: 'insensitive' };
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { city: { contains: String(search), mode: 'insensitive' } },
        { info: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const [pois, total] = await Promise.all([
      prisma.poi.findMany({
        where,
        orderBy: [
          { featured: 'desc' },
          { landingActive: 'desc' },
          { landingSortOrder: 'asc' },
          { updatedAt: 'desc' },
          { city: 'asc' },
          { name: 'asc' },
        ],
        skip: (parsedPage - 1) * parsedLimit,
        take: parsedLimit,
      }),
      prisma.poi.count({ where }),
    ]);

    // Map POI fields to frontend Place interface
    const items = pois.map((p) => ({
      ...p,
      category: TYPE_TO_CATEGORY[p.type] || p.type,
      image: p.imageUrl || null,
      status: 'active',
      rating: p.rating ?? null,
      reviewCount: p.ratingCount ?? null,
    }));

    return success(res, { items, total, page: parsedPage, limit: parsedLimit });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function getPlace(req, res) {
  try {
    const poi = await prisma.poi.findFirst({
      where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
    });
    if (!poi) return error(res, 'Topilmadi', 404);
    return success(res, { ...poi, category: TYPE_TO_CATEGORY[poi.type] || poi.type, image: poi.imageUrl || null, status: 'active' });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function createPlace(req, res) {
  try {
    const {
      name, city, type: rawType, category, subtype, lat, lng, info, description, imageUrl,
      price, priceLevel, rating, ratingCount, icon, openingHours, source, sourceUrl, confidenceScore, verifiedBy,
      duplicateGroupId, priceUpdatedAt, lastVerifiedAt, featured, manualBoost, qualityScore, landingSortOrder, landingActive,
    } = req.body;
    // Accept both 'type' (English) and 'category' (Uzbek key from form)
    const type = rawType || CATEGORY_TO_TYPE[category] || category || 'landmark';
    if (!name || !city || lat === undefined || lng === undefined) {
      return error(res, 'name, city, lat, lng majburiy', 400);
    }
    const slug = await uniqueSlug(slugify(name));
    const poi = await prisma.poi.create({
      data: {
        name: String(name), city: String(city), slug,
        type: String(type), subtype: subtype ? String(subtype) : null,
        lat: Number(lat), lng: Number(lng),
        info: info ? String(info) : '',
        description: description ? String(description) : null,
        imageUrl: imageUrl ? String(imageUrl) : null,
        rating: rating !== undefined && rating !== null && rating !== '' ? Number(rating) : null,
        ratingCount: ratingCount !== undefined && ratingCount !== null && ratingCount !== '' ? Number(ratingCount) : null,
        priceLevel: priceLevel !== undefined && priceLevel !== null && priceLevel !== '' ? Number(priceLevel) : null,
        price: price ? parseInt(String(price), 10) : null,
        openingHours: normalizeJsonArray(openingHours),
        source: source ? String(source) : 'manual',
        sourceUrl: sourceUrl ? String(sourceUrl) : null,
        confidenceScore: confidenceScore !== undefined ? Number(confidenceScore) : 0.65,
        verifiedBy: verifiedBy ? String(verifiedBy) : 'admin',
        duplicateGroupId: duplicateGroupId ? String(duplicateGroupId) : null,
        priceUpdatedAt: priceUpdatedAt ? new Date(priceUpdatedAt) : null,
        lastVerifiedAt: lastVerifiedAt ? new Date(lastVerifiedAt) : new Date(),
        featured: normalizeBoolean(featured),
        manualBoost: manualBoost !== undefined ? Number(manualBoost) || 0 : 0,
        qualityScore: qualityScore !== undefined ? Math.max(0, Math.min(1, Number(qualityScore) || 0)) : 0.7,
        landingSortOrder: landingSortOrder !== undefined ? Number.parseInt(String(landingSortOrder), 10) || 0 : 0,
        landingActive: landingActive !== undefined ? normalizeBoolean(landingActive) : true,
        icon: icon || TYPE_ICON[type] || '📍',
      },
    });
    return success(res, { ...poi, category: TYPE_TO_CATEGORY[poi.type] || poi.type, image: poi.imageUrl || null, status: 'active' }, 201);
  } catch (err) {
    if (err.code === 'P2002') return error(res, 'Bu joy allaqachon mavjud', 409);
    return error(res, err.message, 500);
  }
}

async function updatePlace(req, res) {
  try {
    const existing = await prisma.poi.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Topilmadi', 404);
    const {
      name, city, type: rawType, category, subtype, lat, lng, info, description, imageUrl,
      price, priceLevel, rating, ratingCount, icon, openingHours, source, sourceUrl, confidenceScore, verifiedBy,
      duplicateGroupId, priceUpdatedAt, lastVerifiedAt, featured, manualBoost, qualityScore, landingSortOrder, landingActive,
    } = req.body;
    const data = {};
    if (name !== undefined) { data.name = String(name); if (name !== existing.name) data.slug = await uniqueSlug(slugify(name)); }
    if (city    !== undefined) data.city    = String(city);
    // Accept both 'type' (English) and 'category' (Uzbek key from form)
    const resolvedType = rawType || (category ? CATEGORY_TO_TYPE[category] || category : undefined);
    if (resolvedType !== undefined) data.type = String(resolvedType);
    if (subtype !== undefined) data.subtype = subtype ? String(subtype) : null;
    if (lat     !== undefined) data.lat     = Number(lat);
    if (lng     !== undefined) data.lng     = Number(lng);
    if (info    !== undefined) data.info    = String(info);
    if (description !== undefined) data.description = description ? String(description) : null;
    if (imageUrl !== undefined) data.imageUrl = imageUrl ? String(imageUrl) : null;
    if (rating !== undefined) data.rating = rating !== null && rating !== '' ? Number(rating) : null;
    if (ratingCount !== undefined) data.ratingCount = ratingCount !== null && ratingCount !== '' ? Number(ratingCount) : null;
    if (priceLevel !== undefined) data.priceLevel = priceLevel !== null && priceLevel !== '' ? Number(priceLevel) : null;
    if (price   !== undefined) data.price   = price ? parseInt(String(price), 10) : null;
    if (openingHours !== undefined) data.openingHours = normalizeJsonArray(openingHours);
    if (icon    !== undefined) data.icon    = String(icon);
    if (source !== undefined) data.source = source ? String(source) : 'manual';
    if (sourceUrl !== undefined) data.sourceUrl = sourceUrl ? String(sourceUrl) : null;
    if (confidenceScore !== undefined) data.confidenceScore = Number(confidenceScore);
    if (verifiedBy !== undefined) data.verifiedBy = verifiedBy ? String(verifiedBy) : null;
    if (duplicateGroupId !== undefined) data.duplicateGroupId = duplicateGroupId ? String(duplicateGroupId) : null;
    if (priceUpdatedAt !== undefined) data.priceUpdatedAt = priceUpdatedAt ? new Date(priceUpdatedAt) : null;
    if (featured !== undefined) data.featured = normalizeBoolean(featured);
    if (manualBoost !== undefined) data.manualBoost = Number(manualBoost) || 0;
    if (qualityScore !== undefined) data.qualityScore = Math.max(0, Math.min(1, Number(qualityScore) || 0));
    if (landingSortOrder !== undefined) data.landingSortOrder = Number.parseInt(String(landingSortOrder), 10) || 0;
    if (landingActive !== undefined) data.landingActive = normalizeBoolean(landingActive);
    data.lastVerifiedAt = lastVerifiedAt ? new Date(lastVerifiedAt) : new Date();
    const poi = await prisma.poi.update({ where: { id: req.params.id }, data });
    return success(res, { ...poi, category: TYPE_TO_CATEGORY[poi.type] || poi.type, image: poi.imageUrl || null, status: 'active' });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function deletePlace(req, res) {
  try {
    const existing = await prisma.poi.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Topilmadi', 404);
    await prisma.poi.delete({ where: { id: req.params.id } });
    return success(res, { id: req.params.id });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

function formatAdminHeroSlide(item) {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    subtitle: item.subtitle,
    imageUrl: item.imageUrl,
    actionUrl: item.actionUrl,
    placeSlug: item.placeSlug,
    sortOrder: item.sortOrder,
    active: item.active,
    source: item.source,
    sourceUrl: item.sourceUrl,
    lastVerifiedAt: item.lastVerifiedAt,
    confidenceScore: item.confidenceScore,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

const MAX_HERO_IMAGE_BYTES = 8 * 1024 * 1024;
const HERO_UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'), 'hero');
const IMAGE_EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function isValidExternalUrl(value) {
  return /^https?:\/\/\S+$/i.test(String(value || '').trim());
}

function isValidActionUrl(value) {
  const text = String(value || '').trim();
  return isValidExternalUrl(text) || text.startsWith('/') || text.startsWith('#');
}

function isValidImageUrl(value) {
  const text = String(value || '').trim();
  if (/^\/uploads\/hero\/[a-z0-9._-]+\.(png|jpe?g|webp|gif)$/i.test(text)) return true;
  if (isValidExternalUrl(text)) return true;
  if (text.length > 4_500_000) return false;
  return /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(text);
}

function getMimeExtension(contentType) {
  const mime = String(contentType || '').split(';')[0].trim().toLowerCase();
  return IMAGE_EXTENSION_BY_MIME[mime] || null;
}

function getExtensionFromUrl(value) {
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    const ext = path.extname(pathname).replace('.', '');
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
  } catch {}
  return null;
}

function normalizeRemoteImageUrl(value) {
  const text = String(value || '').trim();
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();

    if (host === 'drive.google.com') {
      const fileId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get('id');
      if (fileId) return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
    }

    if (host.endsWith('dropbox.com')) {
      url.searchParams.delete('dl');
      url.searchParams.set('raw', '1');
      return url.toString();
    }
  } catch {}
  return text;
}

async function saveHeroImageBuffer(buffer, extension) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Rasm fayli bo\'sh');
  }
  if (buffer.length > MAX_HERO_IMAGE_BYTES) {
    throw new Error('Hero rasmi 8 MB dan oshmasin');
  }

  await fs.mkdir(HERO_UPLOAD_DIR, { recursive: true });
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 18);
  const filename = `${Date.now()}-${hash}.${extension}`;
  const diskPath = path.join(HERO_UPLOAD_DIR, filename);
  await fs.writeFile(diskPath, buffer);
  return `/uploads/hero/${filename}`;
}

async function materializeHeroImage(value) {
  const text = String(value || '').trim();
  if (!text) return text;
  if (/^\/uploads\/hero\//i.test(text)) return text;

  const dataMatch = text.match(/^data:image\/(png|jpe?g|webp|gif);base64,([a-z0-9+/=]+)$/i);
  if (dataMatch) {
    const extension = dataMatch[1].toLowerCase().replace('jpeg', 'jpg');
    return saveHeroImageBuffer(Buffer.from(dataMatch[2], 'base64'), extension);
  }

  if (!isValidExternalUrl(text)) {
    throw new Error('Rasm URL http/https link yoki rasm fayl bo\'lishi kerak');
  }

  const remoteUrl = normalizeRemoteImageUrl(text);
  const response = await fetch(remoteUrl, {
    headers: {
      accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'user-agent': 'TravelorAI/1.0 (+https://travelorai.com)',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Rasm URL ochilmadi (${response.status})`);
  }

  const contentType = response.headers.get('content-type') || '';
  const extension = getMimeExtension(contentType) || getExtensionFromUrl(remoteUrl);
  if (!extension) {
    throw new Error('Rasm URL bevosita PNG/JPG/WEBP/GIF faylga olib borishi kerak');
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_HERO_IMAGE_BYTES) {
    throw new Error('Hero rasmi 8 MB dan oshmasin');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return saveHeroImageBuffer(buffer, extension);
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

function normalizeHeroSlideBody(body = {}, partial = false) {
  const data = {};
  const setNullableString = (key) => {
    if (body[key] !== undefined) data[key] = body[key] ? String(body[key]).trim() : null;
  };

  if (body.title !== undefined) data.title = String(body.title).trim();
  if (body.subtitle !== undefined) data.subtitle = body.subtitle ? String(body.subtitle).trim() : null;
  if (body.imageUrl !== undefined) data.imageUrl = String(body.imageUrl).trim();
  setNullableString('actionUrl');
  setNullableString('placeSlug');
  setNullableString('sourceUrl');
  if (body.source !== undefined) data.source = body.source ? String(body.source).trim() : 'admin';
  else if (!partial) data.source = 'admin';
  if (body.sortOrder !== undefined) data.sortOrder = Number.parseInt(String(body.sortOrder), 10) || 0;
  else if (!partial) data.sortOrder = 0;
  if (body.active !== undefined) data.active = normalizeBoolean(body.active);
  else if (!partial) data.active = true;
  if (body.confidenceScore !== undefined) {
    const score = Number(body.confidenceScore);
    data.confidenceScore = Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0.8;
  } else if (!partial) {
    data.confidenceScore = 0.8;
  }
  if (body.lastVerifiedAt !== undefined) data.lastVerifiedAt = body.lastVerifiedAt ? new Date(body.lastVerifiedAt) : null;
  else if (!partial) data.lastVerifiedAt = new Date();

  return data;
}

async function getHeroSlides(req, res) {
  try {
    const items = await prisma.homeHeroSlide.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return success(res, { items: items.map(formatAdminHeroSlide), total: items.length });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function createHeroSlide(req, res) {
  try {
    const data = normalizeHeroSlideBody(req.body || {});
    if (!data.title || !data.imageUrl) return error(res, 'title va imageUrl majburiy', 400);
    data.imageUrl = await materializeHeroImage(data.imageUrl);
    if (!isValidImageUrl(data.imageUrl)) return error(res, "imageUrl http/https URL yoki data:image bo'lishi kerak", 400);
    if (data.actionUrl && !isValidActionUrl(data.actionUrl)) return error(res, 'actionUrl http/https, /path yoki #anchor bolishi kerak', 400);
    if (data.sourceUrl && !isValidExternalUrl(data.sourceUrl)) return error(res, 'sourceUrl http yoki https URL bolishi kerak', 400);

    const requestedSlug = req.body && req.body.slug ? slugify(req.body.slug) : slugify(data.title);
    data.slug = await uniqueHeroSlideSlug(requestedSlug);

    const item = await prisma.homeHeroSlide.create({ data });
    return success(res, formatAdminHeroSlide(item), 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function updateHeroSlide(req, res) {
  try {
    const existing = await prisma.homeHeroSlide.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Hero slide topilmadi', 404);

    const data = normalizeHeroSlideBody(req.body || {}, true);
    if (data.title !== undefined && !data.title) return error(res, 'title bosh bolmasligi kerak', 400);
    if (data.imageUrl !== undefined) data.imageUrl = await materializeHeroImage(data.imageUrl);
    if (data.imageUrl !== undefined && !isValidImageUrl(data.imageUrl)) return error(res, "imageUrl http/https URL yoki data:image bo'lishi kerak", 400);
    if (data.actionUrl && !isValidActionUrl(data.actionUrl)) return error(res, 'actionUrl http/https, /path yoki #anchor bolishi kerak', 400);
    if (data.sourceUrl && !isValidExternalUrl(data.sourceUrl)) return error(res, 'sourceUrl http yoki https URL bolishi kerak', 400);

    if (req.body && req.body.slug) {
      data.slug = await uniqueHeroSlideSlug(slugify(req.body.slug), existing.id);
    } else if (data.title && data.title !== existing.title) {
      data.slug = await uniqueHeroSlideSlug(slugify(data.title), existing.id);
    }

    const item = await prisma.homeHeroSlide.update({ where: { id: existing.id }, data });
    return success(res, formatAdminHeroSlide(item));
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function deleteHeroSlide(req, res) {
  try {
    await prisma.homeHeroSlide.delete({ where: { id: req.params.id } });
    return success(res, { id: req.params.id });
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Hero slide topilmadi', 404);
    return error(res, err.message, 500);
  }
}

// ── Feedback ──────────────────────────────────────────────────────────────────

function normalizeAgencyBody(body = {}, partial = false) {
  const data = {};
  const setNullableString = (key) => {
    if (body[key] !== undefined) data[key] = body[key] ? String(body[key]).trim() : null;
  };

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.city !== undefined) data.city = String(body.city).trim();
  if (body.specialty !== undefined) data.specialty = String(body.specialty).trim();
  setNullableString('description');
  setNullableString('phone');
  setNullableString('website');
  setNullableString('imageUrl');
  setNullableString('sourceUrl');
  if (body.rating !== undefined) data.rating = Number(body.rating) || 0;
  else if (!partial) data.rating = 0;
  if (body.reviews !== undefined) data.reviews = Number.parseInt(String(body.reviews), 10) || 0;
  else if (!partial) data.reviews = 0;
  if (body.toursCount !== undefined) data.toursCount = Number.parseInt(String(body.toursCount), 10) || 0;
  else if (!partial) data.toursCount = 0;
  if (body.active !== undefined) data.active = normalizeBoolean(body.active);
  else if (!partial) data.active = true;
  if (body.featured !== undefined) data.featured = normalizeBoolean(body.featured);
  else if (!partial) data.featured = false;
  if (body.manualBoost !== undefined) data.manualBoost = Number(body.manualBoost) || 0;
  else if (!partial) data.manualBoost = 0;
  if (body.qualityScore !== undefined) data.qualityScore = Math.max(0, Math.min(1, Number(body.qualityScore) || 0));
  else if (!partial) data.qualityScore = 0.7;
  if (body.landingSortOrder !== undefined) data.landingSortOrder = Number.parseInt(String(body.landingSortOrder), 10) || 0;
  else if (!partial) data.landingSortOrder = 0;
  if (body.source !== undefined) data.source = body.source ? String(body.source).trim() : 'admin';
  else if (!partial) data.source = 'admin';
  if (body.confidenceScore !== undefined) data.confidenceScore = Math.max(0, Math.min(1, Number(body.confidenceScore) || 0));
  else if (!partial) data.confidenceScore = 0.7;
  if (body.lastVerifiedAt !== undefined) data.lastVerifiedAt = body.lastVerifiedAt ? new Date(body.lastVerifiedAt) : null;
  else if (!partial) data.lastVerifiedAt = new Date();

  return data;
}

async function getAgencies(req, res) {
  try {
    const items = await prisma.tourAgency.findMany({
      orderBy: [{ featured: 'desc' }, { landingSortOrder: 'asc' }, { rating: 'desc' }],
      include: { _count: { select: { tours: true } } },
    });
    return success(res, {
      items: items.map((item) => ({ ...item, tourCount: item._count.tours })),
      total: items.length,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function createAgency(req, res) {
  try {
    const data = normalizeAgencyBody(req.body || {});
    if (!data.name || !data.city || !data.specialty) return error(res, 'name, city va specialty majburiy', 400);
    if (data.website && !isValidExternalUrl(data.website)) return error(res, 'website http yoki https URL bolishi kerak', 400);
    if (data.imageUrl && !isValidExternalUrl(data.imageUrl)) return error(res, 'imageUrl http yoki https URL bolishi kerak', 400);
    data.slug = await uniqueAgencySlug(req.body?.slug ? slugify(req.body.slug) : slugify(data.name));
    const item = await prisma.tourAgency.create({ data });
    return success(res, item, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function updateAgency(req, res) {
  try {
    const existing = await prisma.tourAgency.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Agency topilmadi', 404);
    const data = normalizeAgencyBody(req.body || {}, true);
    if (data.name !== undefined && !data.name) return error(res, 'name bosh bolmasligi kerak', 400);
    if (data.website && !isValidExternalUrl(data.website)) return error(res, 'website http yoki https URL bolishi kerak', 400);
    if (data.imageUrl && !isValidExternalUrl(data.imageUrl)) return error(res, 'imageUrl http yoki https URL bolishi kerak', 400);
    if (req.body?.slug) data.slug = await uniqueAgencySlug(slugify(req.body.slug), existing.id);
    else if (data.name && data.name !== existing.name) data.slug = await uniqueAgencySlug(slugify(data.name), existing.id);
    const item = await prisma.tourAgency.update({ where: { id: existing.id }, data });
    return success(res, item);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function deleteAgency(req, res) {
  try {
    await prisma.tourAgency.delete({ where: { id: req.params.id } });
    return success(res, { id: req.params.id });
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Agency topilmadi', 404);
    return error(res, err.message, 500);
  }
}

async function getAgencyApplications(req, res) {
  try {
    const status = String(req.query.status || '').trim();
    const where = status && status !== 'all' ? { status } : {};
    const items = await prisma.agencyApplication.findMany({
      where,
      include: {
        account: true,
        agency: true,
      },
      orderBy: [
        { status: 'asc' },
        { submittedAt: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: 200,
    });

    return success(res, {
      items: items.map((item) => ({
        ...item,
        account: item.account
          ? {
              id: item.account.id,
              email: item.account.email,
              emailVerified: item.account.emailVerified,
              status: item.account.status,
            }
          : null,
      })),
      total: items.length,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function approveAgencyApplication(req, res) {
  try {
    const { adminNote } = adminReviewSchema.parse(req.body || {});
    const application = await prisma.agencyApplication.findUnique({
      where: { id: req.params.id },
      include: { account: true, agency: true },
    });
    if (!application) return error(res, 'Agency ariza topilmadi', 404);

    const now = new Date();
    const specialty = application.serviceTypes.length ? application.serviceTypes.join(', ') : 'Tour agency';
    const agencyData = {
      ownerAccountId: application.accountId,
      name: application.companyName,
      city: application.city,
      description: application.description,
      specialty,
      phone: application.phone,
      telegram: application.telegram || null,
      website: application.website,
      imageUrl: application.imageUrl,
      active: true,
      source: 'agency_portal',
      confidenceScore: 0.85,
      approvalStatus: 'approved',
      approvedAt: now,
      rejectedAt: null,
      adminNote: adminNote || null,
      lastVerifiedAt: now,
    };

    const agency = application.agencyId
      ? await prisma.tourAgency.update({
          where: { id: application.agencyId },
          data: agencyData,
        })
      : await prisma.tourAgency.create({
          data: {
            ...agencyData,
            slug: await uniqueAgencySlug(slugify(application.companyName)),
          },
        });

    const [updated] = await prisma.$transaction([
      prisma.agencyApplication.update({
        where: { id: application.id },
        data: {
          agencyId: agency.id,
          status: 'approved',
          reviewedAt: now,
          adminNote: adminNote || null,
        },
        include: { account: true, agency: true },
      }),
      prisma.agencyAccount.update({
        where: { id: application.accountId },
        data: { status: 'approved' },
      }),
    ]);

    return success(res, updated);
  } catch (err) {
    return error(res, err.errors?.[0]?.message || err.message, 400);
  }
}

async function rejectAgencyApplication(req, res) {
  try {
    const { adminNote } = adminReviewSchema.parse(req.body || {});
    const application = await prisma.agencyApplication.findUnique({
      where: { id: req.params.id },
    });
    if (!application) return error(res, 'Agency ariza topilmadi', 404);

    const now = new Date();
    const operations = [
      prisma.agencyApplication.update({
        where: { id: application.id },
        data: {
          status: 'rejected',
          reviewedAt: now,
          adminNote: adminNote || null,
        },
      }),
      prisma.agencyAccount.update({
        where: { id: application.accountId },
        data: { status: 'rejected' },
      }),
    ];

    if (application.agencyId) {
      operations.push(
        prisma.tourAgency.update({
          where: { id: application.agencyId },
          data: {
            active: false,
            approvalStatus: 'rejected',
            rejectedAt: now,
            adminNote: adminNote || null,
          },
        })
      );
    }

    const [updated] = await prisma.$transaction(operations);
    return success(res, updated);
  } catch (err) {
    return error(res, err.errors?.[0]?.message || err.message, 400);
  }
}

async function getAdminTours(req, res) {
  try {
    const status = String(req.query.status || 'pending_review').trim();
    const where = status && status !== 'all' ? { approvalStatus: status } : {};
    const items = await prisma.tour.findMany({
      where,
      include: { agency: true },
      orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    });
    return success(res, { items, total: items.length, status });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function approveTour(req, res) {
  try {
    const { adminNote } = adminReviewSchema.parse(req.body || {});
    const now = new Date();
    const existing = await prisma.tour.findUnique({
      where: { id: req.params.id },
      include: { agency: true },
    });
    if (!existing) return error(res, 'Tour topilmadi', 404);

    const tour = await prisma.tour.update({
      where: { id: existing.id },
      data: {
        approvalStatus: 'approved',
        active: true,
        badge: normalizeTourBadge(existing.badge),
        imageUrl: resolveTourImageUrl(existing),
        approvedAt: now,
        rejectedAt: null,
        adminNote: adminNote || null,
      },
      include: { agency: true },
    });

    if (tour.agencyId) {
      await prisma.tourAgency.update({
        where: { id: tour.agencyId },
        data: {
          active: true,
          approvalStatus: 'approved',
          approvedAt: tour.agency?.approvedAt || now,
          rejectedAt: null,
          toursCount: await prisma.tour.count({
            where: { agencyId: tour.agencyId, active: true, approvalStatus: 'approved' },
          }),
        },
      });
    }

    return success(res, tour);
  } catch (err) {
    return error(res, err.errors?.[0]?.message || err.message, 400);
  }
}

async function rejectTour(req, res) {
  try {
    const { adminNote } = adminReviewSchema.parse(req.body || {});
    const existing = await prisma.tour.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Tour topilmadi', 404);

    const tour = await prisma.tour.update({
      where: { id: existing.id },
      data: {
        approvalStatus: 'rejected',
        active: false,
        rejectedAt: new Date(),
        adminNote: adminNote || null,
      },
      include: { agency: true },
    });

    return success(res, tour);
  } catch (err) {
    return error(res, err.errors?.[0]?.message || err.message, 400);
  }
}

function adminBookingStatusData(input) {
  const now = new Date();
  const data = {
    status: input.status,
    agencyNote: input.agencyNote || undefined,
    adminNote: input.adminNote || null,
  };

  if (input.status === 'confirmed') data.confirmedAt = now;
  if (input.status === 'rejected') data.rejectedAt = now;
  if (input.status === 'cancelled') data.cancelledAt = now;
  if (input.status === 'completed') data.completedAt = now;

  return data;
}

async function getBookings(req, res) {
  try {
    const status = String(req.query.status || 'pending').trim();
    const where = status && status !== 'all' ? { status } : {};
    const items = await prisma.tourBooking.findMany({
      where,
      include: { tour: true, agency: true },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });

    return success(res, {
      items: items.map(formatBooking),
      total: items.length,
      status,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function updateBookingStatus(req, res) {
  try {
    const input = bookingStatusSchema.parse(req.body || {});
    const existing = await prisma.tourBooking.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) return error(res, 'Booking topilmadi', 404);

    const updated = await prisma.tourBooking.update({
      where: { id: existing.id },
      data: adminBookingStatusData(input),
      include: { tour: true, agency: true },
    });

    // Foydalanuvchiga push (token bor bo'lsa) — fire-and-forget
    if (updated.userId) {
      const labels = { confirmed: 'qabul qilindi', rejected: 'rad etildi', cancelled: 'bekor qilindi', completed: 'yakunlandi' };
      const label = labels[updated.status];
      if (label) {
        prisma.user
          .findUnique({ where: { id: updated.userId }, select: { expoPushToken: true } })
          .then((user) => {
            if (user?.expoPushToken) {
              return sendPushNotification({
                to: user.expoPushToken,
                title: 'Booking holati yangilandi',
                body: `${updated.tour?.title || 'Tur'} bo‘yicha so‘rovingiz ${label}.`,
                data: { type: 'booking_status', bookingId: updated.id, status: updated.status },
              });
            }
          })
          .catch(() => {});
      }
    }

    return success(res, { booking: formatBooking(updated) });
  } catch (err) {
    return error(res, err.errors?.[0]?.message || err.message, 400);
  }
}

function normalizeStoryBody(body = {}, partial = false) {
  const data = {};
  const setNullableString = (key) => {
    if (body[key] !== undefined) data[key] = body[key] ? String(body[key]).trim() : null;
  };

  if (body.quote !== undefined) data.quote = String(body.quote).trim();
  if (body.authorName !== undefined) data.authorName = String(body.authorName).trim();
  if (body.authorRole !== undefined) data.authorRole = String(body.authorRole).trim();
  setNullableString('avatar');
  setNullableString('avatarColor');
  setNullableString('sourceUrl');
  if (body.rating !== undefined) data.rating = Math.max(1, Math.min(5, Number.parseInt(String(body.rating), 10) || 5));
  else if (!partial) data.rating = 5;
  if (body.sortOrder !== undefined) data.sortOrder = Number.parseInt(String(body.sortOrder), 10) || 0;
  else if (!partial) data.sortOrder = 0;
  if (body.active !== undefined) data.active = normalizeBoolean(body.active);
  else if (!partial) data.active = true;
  if (body.featured !== undefined) data.featured = normalizeBoolean(body.featured);
  else if (!partial) data.featured = false;
  if (body.manualBoost !== undefined) data.manualBoost = Number(body.manualBoost) || 0;
  else if (!partial) data.manualBoost = 0;
  if (body.qualityScore !== undefined) data.qualityScore = Math.max(0, Math.min(1, Number(body.qualityScore) || 0));
  else if (!partial) data.qualityScore = 0.8;
  if (body.source !== undefined) data.source = body.source ? String(body.source).trim() : 'admin';
  else if (!partial) data.source = 'admin';
  if (body.confidenceScore !== undefined) data.confidenceScore = Math.max(0, Math.min(1, Number(body.confidenceScore) || 0));
  else if (!partial) data.confidenceScore = 0.8;
  if (body.lastVerifiedAt !== undefined) data.lastVerifiedAt = body.lastVerifiedAt ? new Date(body.lastVerifiedAt) : null;
  else if (!partial) data.lastVerifiedAt = new Date();

  return data;
}

async function getStories(req, res) {
  try {
    const items = await prisma.travelerStory.findMany({
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return success(res, { items, total: items.length });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function createStory(req, res) {
  try {
    const data = normalizeStoryBody(req.body || {});
    if (!data.quote || !data.authorName || !data.authorRole) {
      return error(res, 'quote, authorName va authorRole majburiy', 400);
    }
    data.slug = await uniqueStorySlug(req.body?.slug ? slugify(req.body.slug) : slugify(data.authorName + '-' + Date.now()));
    const item = await prisma.travelerStory.create({ data });
    return success(res, item, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function updateStory(req, res) {
  try {
    const existing = await prisma.travelerStory.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Story topilmadi', 404);
    const data = normalizeStoryBody(req.body || {}, true);
    if (data.quote !== undefined && !data.quote) return error(res, 'quote bosh bolmasligi kerak', 400);
    if (req.body?.slug) data.slug = await uniqueStorySlug(slugify(req.body.slug), existing.id);
    const item = await prisma.travelerStory.update({ where: { id: existing.id }, data });
    return success(res, item);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function deleteStory(req, res) {
  try {
    await prisma.travelerStory.delete({ where: { id: req.params.id } });
    return success(res, { id: req.params.id });
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Story topilmadi', 404);
    return error(res, err.message, 500);
  }
}

async function getTransportProviders(req, res) {
  try {
    const providers = await prisma.transportProvider.findMany({
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { routes: true } } },
    });
    return success(res, {
      items: providers.map((provider) => ({ ...provider, routeCount: provider._count.routes })),
      total: providers.length,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function createTransportProvider(req, res) {
  try {
    const { name, type = 'transport', website, supportPhone, source, sourceUrl, confidenceScore } = req.body || {};
    if (!name) return error(res, 'name majburiy', 400);
    const provider = await prisma.transportProvider.create({
      data: {
        name: String(name),
        slug: await uniqueProviderSlug(slugify(name)),
        type: String(type),
        website: website ? String(website) : null,
        supportPhone: supportPhone ? String(supportPhone) : null,
        source: source ? String(source) : 'manual',
        sourceUrl: sourceUrl ? String(sourceUrl) : null,
        lastVerifiedAt: new Date(),
        confidenceScore: confidenceScore !== undefined ? Number(confidenceScore) : 0.65,
      },
    });
    return success(res, provider, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function updateTransportProvider(req, res) {
  try {
    const existing = await prisma.transportProvider.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Provider topilmadi', 404);
    const { name, type, website, supportPhone, source, sourceUrl, confidenceScore } = req.body || {};
    const data = {};
    if (name !== undefined) {
      data.name = String(name);
      if (name !== existing.name) data.slug = await uniqueProviderSlug(slugify(name));
    }
    if (type !== undefined) data.type = String(type);
    if (website !== undefined) data.website = website ? String(website) : null;
    if (supportPhone !== undefined) data.supportPhone = supportPhone ? String(supportPhone) : null;
    if (source !== undefined) data.source = source ? String(source) : 'manual';
    if (sourceUrl !== undefined) data.sourceUrl = sourceUrl ? String(sourceUrl) : null;
    if (confidenceScore !== undefined) data.confidenceScore = Number(confidenceScore);
    data.lastVerifiedAt = new Date();
    const provider = await prisma.transportProvider.update({ where: { id: req.params.id }, data });
    return success(res, provider);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function deleteTransportProvider(req, res) {
  try {
    await prisma.transportProvider.delete({ where: { id: req.params.id } });
    return success(res, { id: req.params.id });
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Provider topilmadi', 404);
    return error(res, err.message, 500);
  }
}

async function getTransportRoutes(req, res) {
  try {
    const { from, to, mode, active, page = '1', limit = '50' } = req.query;
    const parsedPage = Math.max(1, parseInt(String(page), 10) || 1);
    const parsedLimit = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 50));
    const where = {};
    if (from) where.fromCity = { contains: String(from), mode: 'insensitive' };
    if (to) where.toCity = { contains: String(to), mode: 'insensitive' };
    if (mode) where.mode = String(mode);
    if (active !== undefined) where.active = String(active) !== 'false';

    const [routes, total] = await Promise.all([
      prisma.transportRoute.findMany({
        where,
        include: { provider: true },
        orderBy: [{ fromCity: 'asc' }, { toCity: 'asc' }, { mode: 'asc' }],
        skip: (parsedPage - 1) * parsedLimit,
        take: parsedLimit,
      }),
      prisma.transportRoute.count({ where }),
    ]);

    return success(res, { items: routes, total, page: parsedPage, limit: parsedLimit });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function createTransportRoute(req, res) {
  try {
    const data = normalizeTransportRouteBody(req.body || {});
    if (!data.fromCity || !data.toCity || !data.mode) {
      return error(res, 'fromCity, toCity va mode majburiy', 400);
    }
    const route = await prisma.transportRoute.create({ data, include: { provider: true } });
    return success(res, route, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function updateTransportRoute(req, res) {
  try {
    const existing = await prisma.transportRoute.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Transport route topilmadi', 404);
    const route = await prisma.transportRoute.update({
      where: { id: req.params.id },
      data: normalizeTransportRouteBody(req.body || {}, true),
      include: { provider: true },
    });
    return success(res, route);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function deleteTransportRoute(req, res) {
  try {
    await prisma.transportRoute.delete({ where: { id: req.params.id } });
    return success(res, { id: req.params.id });
  } catch (err) {
    if (err.code === 'P2025') return error(res, 'Transport route topilmadi', 404);
    return error(res, err.message, 500);
  }
}

async function uniqueProviderSlug(base) {
  const safe = base || ('provider-' + Date.now());
  let slug = safe;
  let i = 1;
  while (await prisma.transportProvider.findFirst({ where: { slug } })) {
    slug = safe + '-' + i++;
  }
  return slug;
}

function normalizeTransportRouteBody(body, partial = false) {
  const data = {};
  const setString = (key) => {
    if (body[key] !== undefined) data[key] = body[key] ? String(body[key]) : '';
  };
  const setNullableString = (key) => {
    if (body[key] !== undefined) data[key] = body[key] ? String(body[key]) : null;
  };
  const setNumber = (key, fallback) => {
    if (body[key] !== undefined) data[key] = Number(body[key]) || fallback;
    else if (!partial) data[key] = fallback;
  };
  setString('fromCity');
  setString('toCity');
  setString('mode');
  setNullableString('providerId');
  setNumber('priceMin', 0);
  setNumber('priceMax', 0);
  setNumber('durationMinutes', 60);
  if (body.distanceKm !== undefined) data.distanceKm = body.distanceKm === '' || body.distanceKm === null ? null : Number(body.distanceKm);
  setString('scheduleNote');
  setNullableString('bookingUrl');
  setString('source');
  setNullableString('sourceUrl');
  if (body.confidenceScore !== undefined) data.confidenceScore = Number(body.confidenceScore);
  else if (!partial) data.confidenceScore = 0.6;
  setNullableString('whyRecommended');
  if (body.active !== undefined) data.active = Boolean(body.active);
  if (body.lastVerifiedAt !== undefined) data.lastVerifiedAt = body.lastVerifiedAt ? new Date(body.lastVerifiedAt) : null;
  else if (!partial) data.lastVerifiedAt = new Date();
  if (!partial) {
    if (!data.source) data.source = 'manual';
    if (!data.scheduleNote) data.scheduleNote = 'Jadval qoʻlda tekshiriladi';
  }
  return data;
}

async function getFeedback(req, res) {
  try {
    const { category, page = '1', limit = '20' } = req.query;
    const parsedPage = Math.max(1, parseInt(String(page), 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));

    const where = {};
    if (category) where.category = String(category);

    const [items, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (parsedPage - 1) * parsedLimit,
        take: parsedLimit,
      }),
      prisma.feedback.count({ where }),
    ]);

    return success(res, { items, total, page: parsedPage, limit: parsedLimit });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function deleteFeedback(req, res) {
  try {
    const existing = await prisma.feedback.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Topilmadi', 404);
    await prisma.feedback.delete({ where: { id: req.params.id } });
    return success(res, { id: req.params.id });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

// ===== Yangi premium admin panel endpointlari =====
async function updateFeedbackStatus(req, res) {
  try {
    const next = String(req.body?.status || '').toLowerCase() === 'resolved' ? 'resolved' : 'new';
    const item = await prisma.feedback.update({ where: { id: req.params.id }, data: { status: next } });
    return success(res, { id: item.id, status: item.status });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function deleteAdminTour(req, res) {
  try {
    await prisma.tour.delete({ where: { id: req.params.id } });
    return success(res, { deleted: true });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function getReviews(req, res) {
  try {
    const items = await prisma.tripReview.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { name: true, email: true } },
        trip: { select: { title: true } },
      },
    });
    return success(res, {
      items: items.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        author: r.user?.name || 'Foydalanuvchi',
        authorEmail: r.user?.email || null,
        tourTitle: r.trip?.title || 'Sayohat',
      })),
      total: items.length,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function deleteReview(req, res) {
  try {
    await prisma.tripReview.delete({ where: { id: req.params.id } });
    return success(res, { deleted: true });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function getReports(req, res) {
  try {
    const COMMISSION = 0.05;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [bookings, statusGroups, paidCount, last30] = await Promise.all([
      prisma.tourBooking.findMany({
        select: { totalEstimate: true, status: true, tourId: true, tour: { select: { title: true, city: true } } },
      }),
      prisma.tourBooking.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.tourBooking.count({ where: { status: { in: ['confirmed', 'completed'] } } }),
      prisma.tourBooking.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    ]);

    const paid = bookings.filter((b) => b.status === 'confirmed' || b.status === 'completed');
    const totalRevenue = paid.reduce((s, b) => s + (b.totalEstimate || 0), 0);
    const tourMap = {};
    for (const b of paid) {
      if (!tourMap[b.tourId]) tourMap[b.tourId] = { title: b.tour?.title || 'Tur', city: b.tour?.city || '', bookings: 0, revenue: 0 };
      tourMap[b.tourId].bookings += 1;
      tourMap[b.tourId].revenue += b.totalEstimate || 0;
    }
    const topTours = Object.values(tourMap).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

    return success(res, {
      totalRevenue,
      commission: Math.round(totalRevenue * COMMISSION),
      commissionRate: COMMISSION,
      paidBookings: paidCount,
      last30Days: last30,
      byStatus: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
      topTours,
      currency: 'USD',
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function createPartner(req, res) {
  try {
    const bcrypt = require('bcryptjs');
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 8) {
      return error(res, 'Email va kamida 8 belgili parol majburiy.', 422);
    }
    const exists = await prisma.agencyAccount.findUnique({ where: { email } });
    if (exists) return error(res, 'Bu email bilan hamkor allaqachon mavjud.', 409);
    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) return error(res, 'Bu email foydalanuvchi sifatida ro‘yxatdan o‘tgan.', 409);

    const passwordHash = await bcrypt.hash(password, 10);
    const account = await prisma.agencyAccount.create({
      data: { email, passwordHash, status: 'approved', emailVerified: true, emailVerifiedAt: new Date() },
    });
    return success(res, { id: account.id, email: account.email, status: account.status }, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

// Admin panel sessiyasini tekshirish (AdminGate uchun) — JWT(role=admin) yetarli.
async function adminMe(req, res) {
  const u = req.adminUser || {};
  return success(res, { user: { name: u.username || 'Admin', username: u.username || 'admin', email: u.email || '', role: 'admin' } });
}

module.exports = {
  adminMe,
  getStats,
  getUsers, getUser, blockUser, deleteUser, sendUserPasswordReset,
  getTrips, getTrip, deleteTrip,
  getPlaces, getPlace, createPlace, updatePlace, deletePlace,
  getHeroSlides, createHeroSlide, updateHeroSlide, deleteHeroSlide,
  getAgencies, createAgency, updateAgency, deleteAgency,
  getAgencyApplications, approveAgencyApplication, rejectAgencyApplication,
  getAdminTours, approveTour, rejectTour,
  getBookings, updateBookingStatus,
  getStories, createStory, updateStory, deleteStory,
  getTransportProviders, createTransportProvider, updateTransportProvider, deleteTransportProvider,
  getTransportRoutes, createTransportRoute, updateTransportRoute, deleteTransportRoute,
  getFeedback, deleteFeedback,
  updateFeedbackStatus, deleteAdminTour, getReviews, deleteReview, getReports, createPartner,
};
