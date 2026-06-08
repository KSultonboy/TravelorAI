const { generateTripPlan } = require('../services/planner.service');
const { success, error } = require('../utils/response');

function normalizePlan(plan) {
  const normalizedDays = (plan.days || []).map((rawDay, index) => {
    const day = rawDay.day || rawDay.dayNumber || index + 1;
    const destination = rawDay.destination || rawDay.city || '';
    const activities = Array.isArray(rawDay.activities) ? rawDay.activities : [];
    const accommodation =
      rawDay.accommodation ||
      (rawDay.hotel
        ? {
            name: rawDay.hotel,
            cost: rawDay.hotelCost || 0,
            type: 'hotel',
          }
        : null);
    const meals = activities
      .filter((item) => item.type === 'food')
      .map((item) => ({
        time: item.time || '',
        name: item.name || 'Ovqat',
        cost: Number(item.cost || 0),
      }));
    const activityCost = activities.reduce((sum, item) => sum + Number(item.cost || 0), 0);
    const dailyCost = rawDay.dailyCost || rawDay.estimatedCost || activityCost + Number(accommodation?.cost || 0);

    return {
      ...rawDay,
      day,
      dayNumber: day,
      destination,
      city: destination,
      activities,
      meals,
      accommodation: accommodation || { name: '', cost: 0, type: 'hotel' },
      transport: rawDay.transport || rawDay.transportNote || '',
      dailyCost,
    };
  });

  return {
    ...plan,
    days: normalizedDays,
  };
}

async function generate(req, res) {
  try {
    const {
      budget,
      duration,
      travelers,
      style,
      interests,
      departureCity,
      city,
      companions,
      foodPreferences,
      transportType,
      flexibility,
      recommendedPoiNames,
      analysisContext,
      poiContext,
    } = req.body;

    const plan = await generateTripPlan({
      budget: Number(budget),
      duration: Number(duration),
      travelers: Number(travelers),
      style,
      interests,
      city,
      companions,
      foodPreferences,
      transportType,
      flexibility,
      recommendedPoiNames,
      analysisContext,
      poiContext,
      departureCity: departureCity || 'xiva',
    });

    return success(res, normalizePlan(plan));
  } catch (err) {
    return error(res, err.message, 500);
  }
}

module.exports = { generate };
