const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { createBookingSchema } = require('../schemas/booking.schema');

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
    totalEstimate: booking.totalEstimate,
    currency: booking.currency,
    source: booking.source,
    agencyNote: booking.agencyNote,
    adminNote: booking.adminNote,
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
          imageUrl: booking.tour.imageUrl,
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
    const totalEstimate = tour.priceMin ? tour.priceMin * input.travelers : null;
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
        status: 'pending',
      },
      include: { tour: true, agency: true },
    });

    return success(res, { booking: formatBooking(booking) }, 201);
  } catch (err) {
    return error(res, err.errors?.[0]?.message || err.message, 400);
  }
}

async function listMine(req, res) {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    const where = req.user?.id ? { userId: req.user.id } : email ? { customerEmail: email } : null;
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
