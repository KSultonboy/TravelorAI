const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

async function uniqueSlug(base) {
  const safe = base || ('poi-' + Date.now());
  let slug = safe;
  let i = 1;
  while (await prisma.poi.findFirst({ where: { slug } })) {
    slug = safe + '-' + i++;
  }
  return slug;
}

const TYPE_ICON = {
  landmark:   '🏛️',
  hotel:      '🏨',
  restaurant: '🍽️',
  transport:  '🚌',
};

const CATEGORY_TO_TYPE = {
  tarixiy:    'landmark',
  mehmonxona: 'hotel',
  restoran:   'restaurant',
  transport:  'transport',
  tabiiy:     'landmark',
  madaniy:    'landmark',
  bino:       'landmark',
};

async function getAll(req, res) {
  try {
    const { type, subtype, city, search, lat, lng, radiusKm, page = '1', limit = '200', includeLegacyProviders = 'false' } = req.query;
    const where = {};
    if (String(includeLegacyProviders).toLowerCase() !== 'true') {
      where.NOT = [
        { source: { contains: 'google', mode: 'insensitive' } },
        { sourceUrl: { contains: 'google', mode: 'insensitive' } },
        { verifiedBy: { contains: 'google', mode: 'insensitive' } },
        { source: { contains: 'mapbox', mode: 'insensitive' } },
        { sourceUrl: { contains: 'mapbox', mode: 'insensitive' } },
        { verifiedBy: { contains: 'mapbox', mode: 'insensitive' } },
        { source: { contains: '2gis', mode: 'insensitive' } },
        { sourceUrl: { contains: '2gis', mode: 'insensitive' } },
        { verifiedBy: { contains: '2gis', mode: 'insensitive' } },
      ];
    }
    if (type)    where.type    = String(type);
    if (subtype) where.subtype = String(subtype);
    if (city)    where.city    = { equals: String(city), mode: 'insensitive' };
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { info: { contains: String(search), mode: 'insensitive' } },
        { city: { contains: String(search), mode: 'insensitive' } },
        { slug: { contains: String(search), mode: 'insensitive' } },
      ];
    }
    const parsedPage  = Math.max(1, parseInt(String(page), 10) || 1);
    const parsedLimit = Math.min(500, Math.max(1, parseInt(String(limit), 10) || 200));
    let items = await prisma.poi.findMany({ where, orderBy: [{ city: 'asc' }, { name: 'asc' }] });
    if (lat !== undefined && lng !== undefined && radiusKm !== undefined) {
      const cLat = Number(lat), cLng = Number(lng), radius = Math.max(0, Number(radiusKm));
      if (!isNaN(cLat) && !isNaN(cLng) && !isNaN(radius)) {
        items = items.filter((p) => haversineKm(cLat, cLng, p.lat, p.lng) <= radius);
      }
    }
    const total      = items.length;
    const pagedItems = items.slice((parsedPage - 1) * parsedLimit, parsedPage * parsedLimit);
    return success(res, { items: pagedItems, total, page: parsedPage, limit: parsedLimit });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function getOne(req, res) {
  try {
    const poi = await prisma.poi.findFirst({
      where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
    });
    if (!poi) return error(res, 'Topilmadi', 404);
    return success(res, poi);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function create(req, res) {
  try {
    const { name, city, type, subtype, lat, lng, info, price, icon } = req.body;
    if (!name || !city || !type || lat === undefined || lng === undefined) {
      return error(res, 'name, city, type, lat, lng majburiy', 400);
    }
    const slug = await uniqueSlug(slugify(name));
    const poi  = await prisma.poi.create({
      data: {
        name:    String(name),
        city:    String(city),
        slug,
        type:    String(type),
        subtype: subtype ? String(subtype) : null,
        lat:     Number(lat),
        lng:     Number(lng),
        info:    info ? String(info) : '',
        price:   price ? parseInt(String(price), 10) : null,
        icon:    icon || TYPE_ICON[type] || '📍',
      },
    });
    return success(res, poi, 201);
  } catch (err) {
    if (err.code === 'P2002') return error(res, 'Bu joy allaqachon mavjud', 409);
    return error(res, err.message, 500);
  }
}

async function update(req, res) {
  try {
    const existing = await prisma.poi.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Topilmadi', 404);
    const { name, city, type, subtype, lat, lng, info, price, icon } = req.body;
    const data = {};
    if (name !== undefined) {
      data.name = String(name);
      if (name !== existing.name) data.slug = await uniqueSlug(slugify(name));
    }
    if (city    !== undefined) data.city    = String(city);
    if (type    !== undefined) data.type    = String(type);
    if (subtype !== undefined) data.subtype = subtype ? String(subtype) : null;
    if (lat     !== undefined) data.lat     = Number(lat);
    if (lng     !== undefined) data.lng     = Number(lng);
    if (info    !== undefined) data.info    = String(info);
    if (price   !== undefined) data.price   = price ? parseInt(String(price), 10) : null;
    if (icon    !== undefined) data.icon    = String(icon);
    const poi = await prisma.poi.update({ where: { id: req.params.id }, data });
    return success(res, poi);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function remove(req, res) {
  try {
    const existing = await prisma.poi.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Topilmadi', 404);
    await prisma.poi.delete({ where: { id: req.params.id } });
    return success(res, { id: req.params.id });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function bulkCreate(req, res) {
  try {
    const places = Array.isArray(req.body && req.body.places) ? req.body.places : [];
    if (!places.length) return error(res, "places massivi bo'sh", 400);
    const results = [];
    for (const p of places) {
      try {
        const type  = CATEGORY_TO_TYPE[p.category] || p.type || 'landmark';
        const slug  = await uniqueSlug(slugify(p.name || '') || ('poi-' + Date.now()));
        const poi   = await prisma.poi.create({
          data: {
            name:    String(p.name    || 'Nomsiz'),
            city:    String(p.city    || 'Global'),
            slug,
            type,
            subtype: p.subtype || null,
            lat:     Number(p.lat),
            lng:     Number(p.lng),
            info:    String(p.note || p.info || ''),
            price:   p.price ? parseInt(String(p.price), 10) : null,
            icon:    p.icon || TYPE_ICON[type] || '📍',
          },
        });
        results.push({ ok: true, poi });
      } catch (e) {
        results.push({ ok: false, name: p.name, error: e.message });
      }
    }
    const imported = results.filter((r) => r.ok).length;
    return success(res, { imported, total: places.length, results });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

module.exports = { getAll, getOne, create, update, remove, bulkCreate };
