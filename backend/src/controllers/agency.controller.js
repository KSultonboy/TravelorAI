const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { signAgencyToken } = require('../utils/agencyJwt');
const { sendEmailChangeCodeEmail, sendVerificationCodeEmail } = require('../services/email.service');
const { materializeDataImage } = require('../utils/dataImage');
const { resolveTourImageUrl } = require('../utils/tourImage');
const { bookingStatusSchema } = require('../schemas/booking.schema');
const { formatBooking } = require('./bookings.controller');
const {
  applicationSchema,
  emailChangeConfirmSchema,
  emailChangeRequestSchema,
  loginSchema,
  registerSchema,
  tourSchema,
  verifyEmailSchema,
} = require('../schemas/agency.schema');

const CODE_EXPIRES_MINUTES = Number(process.env.AGENCY_CODE_EXPIRES_MINUTES || 10);
const EMAIL_CHANGE_MAX_RESENDS = 3;
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@travelorai.local';

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

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function publicAccount(account) {
  if (!account) return null;
  return {
    id: account.id,
    email: account.email,
    pendingEmail: account.pendingEmail || null,
    emailVerified: account.emailVerified,
    emailChangeResendCount: account.emailChangeResendCount || 0,
    emailChangeResendsRemaining: Math.max(0, EMAIL_CHANGE_MAX_RESENDS - Number(account.emailChangeResendCount || 0)),
    status: account.status,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

function publicApplication(application) {
  if (!application) return null;
  return {
    ...application,
    account: application.account ? publicAccount(application.account) : undefined,
  };
}

function publicAgency(agency) {
  if (!agency) return null;
  return {
    id: agency.id,
    slug: agency.slug,
    name: agency.name,
    city: agency.city,
    description: agency.description,
    specialty: agency.specialty,
    rating: agency.rating,
    reviews: agency.reviews,
    toursCount: agency.toursCount,
    phone: agency.phone,
    telegram: agency.telegram,
    website: agency.website,
    imageUrl: agency.imageUrl,
    active: agency.active,
    approvalStatus: agency.approvalStatus,
  };
}

function publicTour(tour) {
  if (!tour) return null;
  return {
    ...tour,
    imageUrl: resolveTourImageUrl(tour),
    agency: tour.agency ? publicAgency(tour.agency) : undefined,
  };
}

async function uniqueAgencySlug(base, currentId) {
  const safe = base || `agency-${Date.now()}`;
  let slug = safe;
  let i = 1;
  while (
    await prisma.tourAgency.findFirst({
      where: { slug, ...(currentId ? { NOT: { id: currentId } } : {}) },
    })
  ) {
    slug = `${safe}-${i++}`;
  }
  return slug;
}

async function uniqueTourSlug(base, currentId) {
  const safe = base || `tour-${Date.now()}`;
  let slug = safe;
  let i = 1;
  while (
    await prisma.tour.findFirst({
      where: { slug, ...(currentId ? { NOT: { id: currentId } } : {}) },
    })
  ) {
    slug = `${safe}-${i++}`;
  }
  return slug;
}

async function issueAgencyCode(account, type = 'EMAIL_VERIFICATION') {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRES_MINUTES * 60 * 1000);

  await prisma.agencyAuthCode.updateMany({
    where: {
      accountId: account.id,
      type,
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });

  await prisma.agencyAuthCode.create({
    data: {
      accountId: account.id,
      type,
      codeHash: hashCode(code),
      expiresAt,
    },
  });

  const delivery =
    type === 'EMAIL_CHANGE'
      ? await sendEmailChangeCodeEmail({
          email: account.email,
          name: account.email,
          newEmail: account.pendingEmail,
          code,
          expiresInMinutes: CODE_EXPIRES_MINUTES,
        })
      : await sendVerificationCodeEmail({
          email: account.email,
          name: account.email,
          code,
          expiresInMinutes: CODE_EXPIRES_MINUTES,
        });

  return delivery;
}

async function consumeAgencyCode(accountId, code, type = 'EMAIL_VERIFICATION') {
  const item = await prisma.agencyAuthCode.findFirst({
    where: {
      accountId,
      type,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!item || item.codeHash !== hashCode(code)) return false;

  await prisma.agencyAuthCode.update({
    where: { id: item.id },
    data: { usedAt: new Date() },
  });
  return true;
}

async function requestEmailChange(req, res) {
  try {
    const input = emailChangeRequestSchema.parse(req.body || {});
    const newEmail = input.newEmail.toLowerCase();
    const account = req.agencyAccount;
    if (newEmail === account.email) return error(res, 'Yangi email hozirgi emaildan farq qilishi kerak', 400);
    if (account.pendingEmail) {
      return error(res, 'Avval boshlangan email almashtirishni kod bilan tasdiqlang', 409);
    }

    const conflict = await prisma.agencyAccount.findFirst({
      where: {
        id: { not: account.id },
        OR: [{ email: newEmail }, { pendingEmail: newEmail }],
      },
    });
    if (conflict) return error(res, 'Bu email boshqa agency akkauntida ishlatilgan', 409);

    const updated = await prisma.agencyAccount.update({
      where: { id: account.id },
      data: {
        pendingEmail: newEmail,
        emailChangeResendCount: 0,
        emailChangeRequestedAt: new Date(),
      },
    });
    const delivery = await issueAgencyCode(updated, 'EMAIL_CHANGE');
    return success(res, {
      account: publicAccount(updated),
      delivery,
      message: `Tasdiqlash kodi eski emailingizga (${updated.email}) yuborildi.`,
      supportEmail: SUPPORT_EMAIL,
    });
  } catch (err) {
    return error(res, err.errors?.[0]?.message || err.message, 400);
  }
}

async function resendEmailChange(req, res) {
  try {
    const account = await prisma.agencyAccount.findUnique({ where: { id: req.agencyAccount.id } });
    if (!account?.pendingEmail) return error(res, 'Email almashtirish so‘rovi topilmadi', 404);
    if (account.emailChangeResendCount >= EMAIL_CHANGE_MAX_RESENDS) {
      return error(res, `Kod 3 marta qayta yuborildi. ${SUPPORT_EMAIL} orqali adminga murojaat qiling.`, 429, {
        code: 'EMAIL_CHANGE_RESEND_LIMIT',
        supportEmail: SUPPORT_EMAIL,
      });
    }

    const updated = await prisma.agencyAccount.update({
      where: { id: account.id },
      data: { emailChangeResendCount: { increment: 1 } },
    });
    const delivery = await issueAgencyCode(updated, 'EMAIL_CHANGE');
    return success(res, {
      account: publicAccount(updated),
      delivery,
      message: 'Kod eski emailga qayta yuborildi.',
      supportEmail: SUPPORT_EMAIL,
    });
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function confirmEmailChange(req, res) {
  try {
    const input = emailChangeConfirmSchema.parse(req.body || {});
    const account = await prisma.agencyAccount.findUnique({ where: { id: req.agencyAccount.id } });
    if (!account?.pendingEmail) return error(res, 'Email almashtirish so‘rovi topilmadi', 404);

    const ok = await consumeAgencyCode(account.id, input.code, 'EMAIL_CHANGE');
    if (!ok) return error(res, 'Kod xato yoki muddati tugagan', 400);

    const conflict = await prisma.agencyAccount.findFirst({
      where: { id: { not: account.id }, email: account.pendingEmail },
    });
    if (conflict) return error(res, 'Yangi email boshqa akkaunt tomonidan band qilingan', 409);

    const [updated] = await prisma.$transaction([
      prisma.agencyAccount.update({
        where: { id: account.id },
        data: {
          email: account.pendingEmail,
          pendingEmail: null,
          emailChangeResendCount: 0,
          emailChangeRequestedAt: null,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.agencyApplication.updateMany({
        where: { accountId: account.id },
        data: { email: account.pendingEmail },
      }),
    ]);

    const token = signAgencyToken({ id: updated.id, email: updated.email, role: 'agency' });
    return success(res, {
      token,
      account: publicAccount(updated),
      message: 'Email muvaffaqiyatli almashtirildi.',
    });
  } catch (err) {
    return error(res, err.errors?.[0]?.message || err.message, 400);
  }
}

async function getLatestApplication(accountId) {
  return prisma.agencyApplication.findFirst({
    where: { accountId },
    include: { agency: true },
    orderBy: { updatedAt: 'desc' },
  });
}

async function getApprovedAgency(accountId) {
  return prisma.tourAgency.findFirst({
    where: {
      ownerAccountId: accountId,
      active: true,
      approvalStatus: 'approved',
    },
  });
}

async function ensureApprovedAgency(req, res) {
  if (req.agencyAccount.status !== 'approved') {
    error(res, 'Admin tasdiqlamaguncha dashboard yopiq', 403);
    return null;
  }

  const agency = await getApprovedAgency(req.agencyAccount.id);
  if (!agency) {
    error(res, 'Tasdiqlangan agency profili topilmadi', 403);
    return null;
  }

  return agency;
}

function bookingStatusData(input) {
  const now = new Date();
  const data = {
    status: input.status,
    agencyNote: input.agencyNote || null,
  };

  if (input.status === 'confirmed') data.confirmedAt = now;
  if (input.status === 'rejected') data.rejectedAt = now;
  if (input.status === 'cancelled') data.cancelledAt = now;
  if (input.status === 'completed') data.completedAt = now;

  return data;
}

async function getBookingStats(agencyId) {
  if (!agencyId) {
    return {
      revenue: 0,
      bookings: 0,
      pending: 0,
      confirmed: 0,
      rejected: 0,
      cancelled: 0,
      completed: 0,
      customers: 0,
      conversion: 0,
    };
  }

  const bookings = await prisma.tourBooking.findMany({
    where: { agencyId },
    select: {
      status: true,
      totalEstimate: true,
      customerEmail: true,
    },
  });

  const stats = {
    revenue: 0,
    bookings: bookings.length,
    pending: 0,
    confirmed: 0,
    rejected: 0,
    cancelled: 0,
    completed: 0,
    customers: new Set(),
    conversion: 0,
  };

  bookings.forEach((booking) => {
    if (booking.status in stats) stats[booking.status] += 1;
    if (booking.customerEmail) stats.customers.add(booking.customerEmail);
    if (['confirmed', 'completed'].includes(booking.status)) {
      stats.revenue += Number(booking.totalEstimate || 0);
    }
  });

  const converted = stats.confirmed + stats.completed;
  return {
    ...stats,
    customers: stats.customers.size,
    conversion: stats.bookings ? Math.round((converted / stats.bookings) * 100) : 0,
  };
}

async function register(req, res) {
  try {
    const input = registerSchema.parse(req.body || {});
    const email = input.email.toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, 10);
    const existing = await prisma.agencyAccount.findUnique({ where: { email } });

    if (existing?.emailVerified) {
      return error(res, 'Bu email bilan agency akkaunt mavjud. Login qiling.', 409);
    }

    const account = existing
      ? await prisma.agencyAccount.update({
          where: { id: existing.id },
          data: { passwordHash, status: 'pending' },
        })
      : await prisma.agencyAccount.create({
          data: { email, passwordHash, status: 'pending' },
        });

    const delivery = await issueAgencyCode(account);
    return success(res, {
      account: publicAccount(account),
      requiresVerification: true,
      delivery,
    }, 201);
  } catch (err) {
    return error(res, err.errors?.[0]?.message || err.message, 400);
  }
}

async function verifyEmail(req, res) {
  try {
    const input = verifyEmailSchema.parse(req.body || {});
    const email = input.email.toLowerCase();
    const account = await prisma.agencyAccount.findUnique({ where: { email } });
    if (!account) return error(res, 'Agency akkaunt topilmadi', 404);

    const ok = await consumeAgencyCode(account.id, input.code);
    if (!ok) return error(res, 'Kod xato yoki muddati tugagan', 400);

    const updated = await prisma.agencyAccount.update({
      where: { id: account.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
      },
    });

    const token = signAgencyToken({ id: updated.id, email: updated.email, role: 'agency' });
    return success(res, { token, account: publicAccount(updated) });
  } catch (err) {
    return error(res, err.errors?.[0]?.message || err.message, 400);
  }
}

async function login(req, res) {
  try {
    const input = loginSchema.parse(req.body || {});
    const email = input.email.toLowerCase();
    const account = await prisma.agencyAccount.findUnique({ where: { email } });
    if (!account) return error(res, 'Login yoki parol xato', 401);

    const passwordOk = await bcrypt.compare(input.password, account.passwordHash);
    if (!passwordOk) return error(res, 'Login yoki parol xato', 401);
    if (!account.emailVerified) return error(res, 'Email tasdiqlanmagan', 403, { code: 'EMAIL_NOT_VERIFIED' });
    if (account.status === 'blocked') return error(res, 'Agency akkaunt bloklangan', 403);

    const updated = await prisma.agencyAccount.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date() },
    });
    const token = signAgencyToken({ id: updated.id, email: updated.email, role: 'agency' });

    return success(res, { token, account: publicAccount(updated) });
  } catch (err) {
    return error(res, err.errors?.[0]?.message || err.message, 400);
  }
}

async function me(req, res) {
  try {
    const [application, agency] = await Promise.all([
      getLatestApplication(req.agencyAccount.id),
      prisma.tourAgency.findFirst({
        where: { ownerAccountId: req.agencyAccount.id },
        include: { _count: { select: { tours: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const [tourStats, bookingStats] = agency
      ? await Promise.all([
          prisma.tour.groupBy({
            by: ['approvalStatus'],
            where: { agencyId: agency.id },
            _count: { _all: true },
          }),
          getBookingStats(agency.id),
        ])
      : [[], await getBookingStats(null)];

    return success(res, {
      account: publicAccount(req.agencyAccount),
      application: publicApplication(application),
      agency: agency ? { ...publicAgency(agency), tourCount: agency._count.tours } : null,
      stats: tourStats.reduce((acc, row) => {
        acc[row.approvalStatus] = row._count._all;
        return acc;
      }, {}),
      bookingStats,
      supportEmail: SUPPORT_EMAIL,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function getApplication(req, res) {
  try {
    const application = await getLatestApplication(req.agencyAccount.id);
    return success(res, { application: publicApplication(application) });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function upsertApplication(req, res) {
  try {
    if (!req.agencyAccount.emailVerified) return error(res, 'Avval emailni tasdiqlang', 403);
    const input = applicationSchema.parse(req.body || {});
    const existing = await getLatestApplication(req.agencyAccount.id);

    if (existing?.status === 'approved') {
      return error(res, 'Tasdiqlangan arizani onboardingdan ozgartirib bolmaydi', 409);
    }

    const data = {
      ...input,
      legalName: input.legalName || null,
      website: input.website || null,
      telegram: input.telegram || null,
      instagram: input.instagram || null,
      imageUrl: input.imageUrl ? await materializeDataImage(input.imageUrl, 'agency') : null,
      status: existing?.status === 'pending' ? 'pending' : 'draft',
    };

    const application = existing
      ? await prisma.agencyApplication.update({ where: { id: existing.id }, data, include: { agency: true } })
      : await prisma.agencyApplication.create({
          data: { ...data, accountId: req.agencyAccount.id },
          include: { agency: true },
        });

    return success(res, { application: publicApplication(application) });
  } catch (err) {
    return error(res, err.errors?.[0]?.message || err.message, 400);
  }
}

async function submitApplication(req, res) {
  try {
    const application = await getLatestApplication(req.agencyAccount.id);
    if (!application) return error(res, 'Avval ariza formasini toldiring', 400);
    if (application.status === 'approved') return error(res, 'Ariza allaqachon tasdiqlangan', 409);

    applicationSchema.parse({
      companyName: application.companyName,
      legalName: application.legalName || '',
      contactPerson: application.contactPerson,
      phone: application.phone,
      email: application.email,
      city: application.city,
      country: application.country,
      website: application.website || '',
      telegram: application.telegram || '',
      instagram: application.instagram || '',
      serviceTypes: application.serviceTypes,
      description: application.description,
      documents: application.documents,
    });

    const updated = await prisma.agencyApplication.update({
      where: { id: application.id },
      data: {
        status: 'pending',
        submittedAt: new Date(),
        reviewedAt: null,
        adminNote: null,
      },
      include: { agency: true },
    });

    await prisma.agencyAccount.update({
      where: { id: req.agencyAccount.id },
      data: { status: 'pending' },
    });

    return success(res, { application: publicApplication(updated) });
  } catch (err) {
    return error(res, err.errors?.[0]?.message || err.message, 400);
  }
}

async function listTours(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;

    const tours = await prisma.tour.findMany({
      where: { agencyId: agency.id },
      include: { agency: true },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return success(res, { items: tours.map(publicTour), total: tours.length });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function createTour(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    const input = tourSchema.parse(req.body || {});
    const slug = await uniqueTourSlug(slugify(input.title));
    const tour = await prisma.tour.create({
      data: {
        ...input,
        description: input.description || null,
        price: input.price || null,
        priceMin: input.priceMin ?? null,
        imageUrl: input.imageUrl ? await materializeDataImage(input.imageUrl, 'agency') : null,
        responseTimeMinutes: input.responseTimeMinutes,
        slug,
        agencyId: agency.id,
        source: 'agency_portal',
        active: false,
        approvalStatus: 'draft',
        confidenceScore: 0.75,
      },
      include: { agency: true },
    });

    return success(res, publicTour(tour), 201);
  } catch (err) {
    return error(res, err.errors?.[0]?.message || err.message, 400);
  }
}

async function updateTour(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    const existing = await prisma.tour.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!existing) return error(res, 'Tour topilmadi', 404);

    const input = tourSchema.partial().parse(req.body || {});
    const nextStatus =
      existing.approvalStatus === 'approved' || existing.approvalStatus === 'pending_review'
        ? 'pending_review'
        : 'draft';
    const data = {
      ...input,
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.price !== undefined ? { price: input.price || null } : {}),
      ...(input.priceMin !== undefined ? { priceMin: input.priceMin ?? null } : {}),
      ...(input.imageUrl !== undefined
        ? { imageUrl: input.imageUrl ? await materializeDataImage(input.imageUrl, 'agency') : null }
        : {}),
      ...(input.responseTimeMinutes !== undefined ? { responseTimeMinutes: input.responseTimeMinutes } : {}),
      approvalStatus: nextStatus,
      active: false,
      submittedAt: nextStatus === 'pending_review' ? new Date() : existing.submittedAt,
      approvedAt: null,
      rejectedAt: null,
      adminNote: null,
    };

    if (input.title && input.title !== existing.title) {
      data.slug = await uniqueTourSlug(slugify(input.title), existing.id);
    }

    const tour = await prisma.tour.update({
      where: { id: existing.id },
      data,
      include: { agency: true },
    });

    return success(res, publicTour(tour));
  } catch (err) {
    return error(res, err.errors?.[0]?.message || err.message, 400);
  }
}

async function submitTour(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    const existing = await prisma.tour.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!existing) return error(res, 'Tour topilmadi', 404);

    const tour = await prisma.tour.update({
      where: { id: existing.id },
      data: {
        approvalStatus: 'pending_review',
        active: false,
        submittedAt: new Date(),
        approvedAt: null,
        rejectedAt: null,
        adminNote: null,
      },
      include: { agency: true },
    });

    return success(res, publicTour(tour));
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function listBookings(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;

    const status = String(req.query.status || '').trim();
    const where = {
      agencyId: agency.id,
      ...(status && status !== 'all' ? { status } : {}),
    };

    const [items, total, stats] = await Promise.all([
      prisma.tourBooking.findMany({
        where,
        include: { tour: true, agency: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.tourBooking.count({ where }),
      getBookingStats(agency.id),
    ]);

    return success(res, { items: items.map(formatBooking), total, stats });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function updateBookingStatus(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;

    const input = bookingStatusSchema.parse(req.body || {});
    const existing = await prisma.tourBooking.findFirst({
      where: { id: req.params.id, agencyId: agency.id },
    });
    if (!existing) return error(res, 'Booking topilmadi', 404);

    const updated = await prisma.tourBooking.update({
      where: { id: existing.id },
      data: bookingStatusData(input),
      include: { tour: true, agency: true },
    });

    return success(res, { booking: formatBooking(updated), stats: await getBookingStats(agency.id) });
  } catch (err) {
    return error(res, err.errors?.[0]?.message || err.message, 400);
  }
}

async function getAgencyProfile(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    return success(res, { agency: publicAgency(agency) });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function updateAgencyProfile(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    const required = ['name', 'city', 'specialty'];
    const nullable = ['description', 'phone', 'telegram', 'website'];
    const data = {};
    for (const key of required) {
      if (req.body?.[key] !== undefined) {
        const value = String(req.body[key] || '').trim();
        if (!value) return error(res, `${key} bosh bolmasligi kerak`, 400);
        data[key] = value;
      }
    }
    for (const key of nullable) {
      if (req.body?.[key] !== undefined) data[key] = req.body[key] ? String(req.body[key]).trim() : null;
    }
    if (req.body?.imageUrl !== undefined) {
      data.imageUrl = req.body.imageUrl
        ? await materializeDataImage(req.body.imageUrl, 'agency')
        : null;
    }
    if (data.name && data.name !== agency.name) data.slug = await uniqueAgencySlug(slugify(data.name), agency.id);

    const updated = await prisma.tourAgency.update({
      where: { id: agency.id },
      data,
    });
    return success(res, { agency: publicAgency(updated) });
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = {
  register,
  verifyEmail,
  requestEmailChange,
  resendEmailChange,
  confirmEmailChange,
  login,
  me,
  getApplication,
  upsertApplication,
  submitApplication,
  getAgencyProfile,
  updateAgencyProfile,
  listTours,
  createTour,
  updateTour,
  submitTour,
  listBookings,
  updateBookingStatus,
};
