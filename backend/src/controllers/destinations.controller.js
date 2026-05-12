const { prisma } = require('../config/database');
const { getCache, setCache } = require('../services/cache.service');
const { success, error } = require('../utils/response');

async function getAll(req, res) {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    const cacheKey = `destinations:${category || ''}:${search || ''}:${page}:${limit}`;

    const cached = await getCache(cacheKey);
    if (cached) return success(res, cached);

    const where = {};
    if (category) {
      where.categories = { has: category };
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { region: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [data, total] = await Promise.all([
      prisma.destination.findMany({ where, skip, take: parseInt(limit), orderBy: { rating: 'desc' } }),
      prisma.destination.count({ where }),
    ]);

    const result = { items: data, total, page: parseInt(page), limit: parseInt(limit) };
    await setCache(cacheKey, result, 600); // 10 daqiqa
    return success(res, result);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function getById(req, res) {
  try {
    const { id } = req.params;
    const cacheKey = `destination:${id}`;

    const cached = await getCache(cacheKey);
    if (cached) return success(res, cached);

    const dest = await prisma.destination.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!dest) return error(res, 'Destinatsiya topilmadi', 404);

    await setCache(cacheKey, dest, 1800); // 30 daqiqa
    return success(res, dest);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

module.exports = { getAll, getById };
