const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');

async function listMyTripReviews(req, res) {
  try {
    const items = await prisma.tripReview.findMany({
      where: { userId: req.user.id },
      include: {
        trip: {
          select: {
            id: true,
            title: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const averageRating =
      items.length > 0
        ? Number((items.reduce((sum, item) => sum + Number(item.rating || 0), 0) / items.length).toFixed(1))
        : 0;

    return success(res, {
      items,
      total: items.length,
      averageRating,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function saveTripReview(req, res) {
  try {
    const { id } = req.params;
    const trip = await prisma.trip.findFirst({
      where: { id, userId: req.user.id },
      select: { id: true, title: true },
    });

    if (!trip) {
      return error(res, 'Trip topilmadi', 404);
    }

    const rating = Math.min(5, Math.max(1, Number(req.body.rating || 0)));
    const comment = String(req.body.comment || '').trim();

    const existing = await prisma.tripReview.findUnique({
      where: {
        userId_tripId: {
          userId: req.user.id,
          tripId: trip.id,
        },
      },
    });

    const review = await prisma.tripReview.upsert({
      where: {
        userId_tripId: {
          userId: req.user.id,
          tripId: trip.id,
        },
      },
      create: {
        userId: req.user.id,
        tripId: trip.id,
        rating,
        comment,
      },
      update: {
        rating,
        comment,
      },
      include: {
        trip: {
          select: {
            id: true,
            title: true,
            createdAt: true,
          },
        },
      },
    });

    return success(
      res,
      {
        message: existing ? 'Trip review yangilandi.' : 'Trip review saqlandi.',
        review,
      },
      existing ? 200 : 201
    );
  } catch (err) {
    return error(res, err.message, 500);
  }
}

module.exports = {
  listMyTripReviews,
  saveTripReview,
};
