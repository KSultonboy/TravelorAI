const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');

async function getAll(req, res) {
  try {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.user.id },
      orderBy: { savedAt: 'desc' },
    });
    return success(res, items);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function create(req, res) {
  try {
    const { poiId, name, city, slug, type, icon } = req.body;

    if (poiId) {
      const poi = await prisma.poi.findUnique({ where: { id: poiId } });
      if (!poi) {
        return error(res, 'POI topilmadi.', 404);
      }
    }

    const item = await prisma.wishlistItem.upsert({
      where: {
        userId_slug: {
          userId: req.user.id,
          slug,
        },
      },
      create: {
        userId: req.user.id,
        poiId: poiId || null,
        name,
        city,
        slug,
        type,
        icon,
      },
      update: {
        poiId: poiId || null,
        name,
        city,
        type,
        icon,
        savedAt: new Date(),
      },
    });

    return success(res, item, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const item = await prisma.wishlistItem.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!item) {
      return error(res, 'Wishlist item topilmadi.', 404);
    }

    await prisma.wishlistItem.delete({ where: { id } });
    return success(res, { success: true });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

module.exports = {
  getAll,
  create,
  remove,
};
