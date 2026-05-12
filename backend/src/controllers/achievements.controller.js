const { prisma } = require('../config/database');
const { getAchievementsFromTrips } = require('../services/achievements.service');
const { success, error } = require('../utils/response');

async function getMyAchievements(req, res) {
  try {
    const trips = await prisma.trip.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        totalCost: true,
        style: true,
        duration: true,
        travelers: true,
        planData: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const state = getAchievementsFromTrips(trips);
    return success(res, state);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

module.exports = {
  getMyAchievements,
};
