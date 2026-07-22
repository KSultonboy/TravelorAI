const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { createBookingSchema } = require('../schemas/booking.schema');
const { sendBookingLeadEmail } = require('../services/email.service');
const { resolveTourImageUrl } = require('../utils/tourImage');

function formatBooking(booking) {
  if (!booking) return null;
  return {
    id: booking.id,
    tourId: booking.tourId,
    agencyId: booking.agencyId,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    travelers: booking.travelers,
    travelDate: booking.travelDate,
    message: booking.message,
    status: booking.status,
    responseDeadlineAt: booking.responseDeadlineAt,
    totalEstimate: booking.totalEstimate,
    currency: booking.currency,
    source: booking.source,
    utmSource: booking.utmSource || null,
    utmMedium: booking.utmMedium || null,
    utmCampaign: booking.utmCampaign || null,
    referrer: booking.referrer || null,
    pipelineStage: booking.pipelineStage || 'new',
    leadTour: booking.leadTour || null,
    customerBirthday: booking.customerBirthday || null,
    agencyNote: booking.agencyNote,
    adminNote: booking.adminNote,
    confirmedAt: booking.confirmedAt,
    rejectedAt: booking.rejectedAt,
    cancelledAt: booking.cancelledAt,
    completedAt: booking.completedAt,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    tour: booking.tour
      ? {
          id: booking.tour.id,
          slug: booking.tour.slug,
          title: booking.tour.title,
          city: booking.tour.city,
          duration: booking.tour.duration,
          price: booking.tour.price,
          priceMin: booking.tour.priceMin,
          priceCurrency: booking.tour.priceCurrency,
          priceBasis: booking.tour.priceBasis,
          imageUrl: resolveTourImageUrl(booking.tour),
          responseTimeMinutes: booking.tour.responseTimeMinutes ?? 45,
          hotelName: booking.tour.hotelName,
          hotelCategory: booking.tour.hotelCategory,
          roomType: booking.tour.roomType,
          mealPlan: booking.tour.mealPlan,
          mealPlanLabel: booking.tour.mealPlanLabel,
          availabilityStatus: booking.tour.availabilityStatus,
        }
      : null,
    agency: booking.agency
      ? {
          id: booking.agency.id,
          slug: booking.agency.slug,
          name: booking.agency.name,
          city: booking.agency.city,
          phone: booking.agency.phone,
          telegram: booking.agency.telegram,
          website: booking.agency.website,
          imageUrl: booking.agency.imageUrl,
        }
      : null,
  };
}

async function create(req, res) {
  try {
    const input = createBookingSchema.parse(req.body || {});
    const where = input.tourId ? { id: input.tourId } : { slug: input.tourSlug };
    const tour = await prisma.tour.findFirst({
      where: {
        ...where,
        active: true,
        approvalStatus: 'approved',
        OR: [{ agencyId: null }, { agency: { is: { active: true, approvalStatus: 'approved' } } }],
      },
      include: { agency: true },
    });

    if (!tour) return error(res, 'Tour topilmadi yoki hali public emas', 404);

    const userId = req.user?.id || null;
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (user && input.customerEmail && user.email.toLowerCase() !== input.customerEmail.toLowerCase()) {
        return error(res, 'Booking emaili akkauntingiz emailiga mos bo‘lishi kerak', 400);
      }
    }
    const totalEstimate = tour.priceMin ? tour.priceMin * input.travelers : null;
    const responseDeadlineAt = new Date(
      Date.now() + Math.max(5, Number(tour.responseTimeMinutes || 45)) * 60 * 1000
    );
    const booking = await prisma.tourBooking.create({
      data: {
        tourId: tour.id,
        agencyId: tour.agencyId,
        userId,
        customerName: input.customerName,
        customerEmail: input.customerEmail ? input.customerEmail.toLowerCase() : null,
        customerPhone: input.customerPhone || null,
        travelers: input.travelers,
        travelDate: input.travelDate ? new Date(input.travelDate) : null,
        message: input.message || null,
        totalEstimate,
        currency: 'USD',
        source: input.source || 'mobile',
        utmSource: input.utmSource || null,
        utmMedium: input.utmMedium || null,
        utmCampaign: input.utmCampaign || null,
        referrer: input.referrer || null,
        status: 'pending',
        responseDeadlineAt,
      },
      include: { tour: true, agency: { include: { ownerAccount: true } } },
    });

    // Notify the agency about the new lead (free) — fire-and-forget
    const agencyEmail = booking.agency?.ownerAccount?.email || null;
    if (agencyEmail) {
      sendBookingLeadEmail({
        to: agencyEmail,
        agencyName: booking.agency.name,
        tourTitle: booking.tour?.title,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        customerEmail: booking.customerEmail,
        travelers: booking.travelers,
        travelDate: booking.travelDate,
        message: booking.message,
      }).catch(() => {});
    }

    return success(res, { booking: formatBooking(booking) }, 201);
  } catch (err) {
    return error(res, err.errors?.[0]?.message || err.message, 400);
  }
}

async function listMine(req, res) {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    let where = email ? { customerEmail: email } : null;
    if (req.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { email: true },
      });
      if (!user) return error(res, 'Foydalanuvchi topilmadi', 404);

      await prisma.tourBooking.updateMany({
        where: {
          userId: null,
          customerEmail: user.email.toLowerCase(),
        },
        data: { userId: req.user.id },
      });
      where = { userId: req.user.id };
    }
    if (!where) return error(res, 'Token yoki email talab qilinadi', 401);

    const items = await prisma.tourBooking.findMany({
      where,
      include: { tour: true, agency: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return success(res, { items: items.map(formatBooking), total: items.length });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

module.exports = {
  create,
  listMine,
  formatBooking,
};
