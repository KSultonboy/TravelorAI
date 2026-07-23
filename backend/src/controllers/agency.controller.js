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
const reviewService = require('../services/review.service');
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
    mustChangePassword: account.mustChangePassword || false,
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

// Galereya — har bir data-URL faylga aylantiriladi (bazada faqat yo'l saqlanadi).
// Allaqachon /uploads/... bo'lgan qiymatlar materializeDataImage'dan o'zgarmay o'tadi.
async function materializeGallery(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list.slice(0, 6)) {
    const value = String(item || '').trim();
    if (!value) continue;
    out.push(await materializeDataImage(value, 'agency'));
  }
  return out;
}

// Joy nuqtalari — nomi + koordinatasi to'g'ri bo'lganlari qoladi.
function sanitizeStops(list, max = 8) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const row of list.slice(0, max)) {
    if (!row || typeof row !== 'object') continue;
    const name = String(row.name || '').trim().slice(0, 120);
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    out.push({ name, lat, lng });
  }
  return out;
}

// Kun bo'yicha reja: [{day, title, places:[{name,lat,lng}]}].
// Eski formatlar (oddiy matn qatori yoki {day,title}) ham buzilmasdan o'tadi.
function sanitizeItinerary(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return null;
  const out = [];
  value.slice(0, 30).forEach((row, i) => {
    if (typeof row === 'string') {
      const title = row.trim().slice(0, 400);
      if (title) out.push({ day: i + 1, title });
      return;
    }
    if (!row || typeof row !== 'object') return;
    const title = String(row.title || row.text || row.description || '').trim().slice(0, 400);
    if (!title) return;
    const dayNum = Number(row.day);
    const day = Number.isFinite(dayNum) && dayNum > 0 ? Math.floor(dayNum) : i + 1;
    const places = sanitizeStops(row.places);
    out.push(places.length ? { day, title, places } : { day, title });
  });
  return out.length ? out : null;
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

  // agencyPlan middleware agentlikni EGASI yoki XODIM (AgencyMember) sifatida topadi.
  // Faqat ownerAccountId bo'yicha qidirsak, taklif qilingan xodim har bir
  // endpointda 403 olardi — jamoa imkoniyati shu sababli ishlamas edi.
  const agency = req.agency || (await getApprovedAgency(req.agencyAccount.id));
  if (!agency || agency.active !== true || agency.approvalStatus !== 'approved') {
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

// Bir martalik parolni almashtirish — birinchi kirishда majburlanadi.
// Har doim ochiq (readOnly/onboarding'да ham), aks holda foydalanuvchi qamalib qoladi.
async function changePassword(req, res) {
  try {
    const account = req.agencyAccount;
    if (!account) return error(res, 'Avval tizimga kiring', 401);
    const newPassword = String((req.body && req.body.newPassword) || '');
    if (newPassword.length < 6) return error(res, 'Yangi parol kamida 6 belgi bo‘lsin', 400);
    if (newPassword.length > 200) return error(res, 'Parol juda uzun', 400);

    // Eski parolni qayta kiritishni taqiqlaymiz (agar bir martalik bo'lsa foydasiz).
    const same = await bcrypt.compare(newPassword, account.passwordHash).catch(() => false);
    if (same) return error(res, 'Yangi parol eskisidan farq qilishi kerak', 400);

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.agencyAccount.update({
      where: { id: account.id },
      data: { passwordHash, mustChangePassword: false },
    });
    return success(res, { changed: true });
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function me(req, res) {
  try {
    const agency = req.agency; // agencyPlan middleware yukladi (tariff + _count bilan)
    const application = await getLatestApplication(req.agencyAccount.id);

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
      access: req.access, // tarif/obuna enforcement holati (sections, caps, readOnly)
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
        images: await materializeGallery(input.images),
        mapAddress: input.mapAddress || null,
        routeStops: input.routeStops && input.routeStops.length ? input.routeStops : null,
        itinerary: sanitizeItinerary(input.itinerary) ?? null,
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
      ...(input.images !== undefined ? { images: await materializeGallery(input.images) } : {}),
      ...(input.mapAddress !== undefined ? { mapAddress: input.mapAddress || null } : {}),
      ...(input.routeStops !== undefined
        ? { routeStops: input.routeStops.length ? input.routeStops : null }
        : {}),
      ...(input.itinerary !== undefined ? { itinerary: sanitizeItinerary(input.itinerary) } : {}),
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
        approvalStatus: 'approved',
        active: true,
        submittedAt: new Date(),
        approvedAt: new Date(),
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

async function createManualLead(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    const b = req.body || {};
    const name = String(b.customerName || '').trim();
    if (name.length < 2) return error(res, 'Mijoz ismini kiriting', 400);
    const est = b.totalEstimate != null && b.totalEstimate !== ''
      ? Math.max(0, parseInt(String(b.totalEstimate).replace(/[^0-9]/g, ''), 10) || 0) : null;
    const booking = await prisma.tourBooking.create({
      data: {
        agencyId: agency.id,
        tourId: null,
        customerName: name,
        customerPhone: b.customerPhone ? String(b.customerPhone).trim() : null,
        customerEmail: b.customerEmail ? String(b.customerEmail).trim().toLowerCase() : null,
        travelers: b.travelers ? Math.max(1, parseInt(b.travelers, 10) || 1) : 1,
        leadTour: b.leadTour ? String(b.leadTour).trim() : (b.tourTitle ? String(b.tourTitle).trim() : null),
        message: b.message ? String(b.message).trim() : null,
        totalEstimate: est,
        currency: 'USD',
        source: 'manual',
        status: 'pending',
        pipelineStage: 'new',
      },
      include: { tour: true, agency: true },
    });
    return success(res, { booking: formatBooking(booking) }, 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

// Mijoz tug'ilgan kunини belgilash (avto-tabrik uchun). Bir mijozning barcha
// yozuvlarига (Telegram chat bo'yicha) yoziladi; birdaydayGreetedOn tozalanadi.
async function setCustomerBirthday(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    const booking = await prisma.tourBooking.findFirst({
      where: { id: String(req.params.id), agencyId: agency.id },
    });
    if (!booking) return error(res, 'Lid topilmadi', 404);

    const raw = String((req.body && req.body.birthday) || '').trim();
    let birthday = null;
    if (raw) {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return error(res, 'Sana notogri', 400);
      birthday = d;
    }
    const data = { customerBirthday: birthday, birthdayGreetedOn: null };
    if (booking.telegramChatId) {
      await prisma.tourBooking.updateMany({
        where: { agencyId: agency.id, telegramChatId: booking.telegramChatId },
        data,
      });
    } else {
      await prisma.tourBooking.update({ where: { id: booking.id }, data });
    }
    return success(res, { birthday });
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function updatePipelineStage(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    const STAGES = ['new', 'contacted', 'quoted', 'won', 'completed', 'lost'];
    const stage = String(req.body && req.body.stage || '').trim();
    if (!STAGES.includes(stage)) return error(res, 'Notogri bosqich', 400);
    const existing = await prisma.tourBooking.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!existing) return error(res, 'Lid topilmadi', 404);
    const now = new Date();
    const data = { pipelineStage: stage };
    if (stage === 'won') { data.status = 'confirmed'; if (!existing.confirmedAt) data.confirmedAt = now; }
    else if (stage === 'completed') { data.status = 'completed'; if (!existing.confirmedAt) data.confirmedAt = now; data.completedAt = now; }
    else if (stage === 'lost') { data.status = 'rejected'; data.rejectedAt = now; }
    const updated = await prisma.tourBooking.update({ where: { id: existing.id }, data, include: { tour: true, agency: true } });
    // Sayohat "yakunlandi"ga o'tdi — mijozdan Telegram orqali baho so'raymiz (fire-and-forget).
    if (stage === 'completed' && existing.pipelineStage !== 'completed') {
      reviewService.sendReviewRequest(updated.agency, updated).catch(() => {});
    }
    return success(res, { booking: formatBooking(updated), stats: await getBookingStats(agency.id) });
  } catch (err) {
    return error(res, (err.errors && err.errors[0] && err.errors[0].message) || err.message, 400);
  }
}

/* Mijoz sharhlari — reyting bilan; publish/hide agentlik reytingini qayta hisoblaydi. */
async function listReviews(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    const reviews = await prisma.tourReview.findMany({
      where: { agencyId: agency.id },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const published = reviews.filter((r) => r.status === 'published');
    const count = published.length;
    const avg = count ? Math.round((published.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
    const dist = [0, 0, 0, 0, 0];
    for (const r of published) if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1] += 1;
    return success(res, { reviews, summary: { count, avg, dist } });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function setReviewStatus(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    const status = String((req.body && req.body.status) || '').trim();
    if (!['published', 'hidden'].includes(status)) return error(res, 'Notogri holat', 400);
    const existing = await prisma.tourReview.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!existing) return error(res, 'Sharh topilmadi', 404);
    await prisma.tourReview.update({ where: { id: existing.id }, data: { status } });
    await reviewService.recomputeAgencyRating(agency.id);
    return success(res, { id: existing.id, status });
  } catch (err) {
    return error(res, err.message, 400);
  }
}

// Lid maydonlarini tahrirlash — batafsil oynadagi "Tahrirlash" tugmasi uchun.
async function updateLead(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    const existing = await prisma.tourBooking.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!existing) return error(res, 'Lid topilmadi', 404);
    const b = req.body || {};
    const data = {};
    if (b.customerName !== undefined) {
      const v = String(b.customerName || '').trim();
      if (!v) return error(res, 'Mijoz ismi bosh bolmasligi kerak', 400);
      data.customerName = v.slice(0, 120);
    }
    if (b.customerEmail !== undefined) data.customerEmail = b.customerEmail ? String(b.customerEmail).trim().slice(0, 160) : null;
    if (b.customerPhone !== undefined) data.customerPhone = b.customerPhone ? String(b.customerPhone).trim().slice(0, 40) : null;
    if (b.leadTour !== undefined) data.leadTour = b.leadTour ? String(b.leadTour).trim().slice(0, 200) : null;
    if (b.leadCity !== undefined) data.leadCity = b.leadCity ? String(b.leadCity).trim().slice(0, 120) : null;
    if (b.travelers !== undefined) {
      const n = parseInt(b.travelers, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= 99) data.travelers = n;
    }
    if (b.totalEstimate !== undefined) {
      if (b.totalEstimate === null || b.totalEstimate === '') data.totalEstimate = null;
      else {
        const n = parseInt(String(b.totalEstimate).replace(/[^\d]/g, ''), 10);
        if (!Number.isNaN(n)) data.totalEstimate = n;
      }
    }
    if (b.travelDate !== undefined) data.travelDate = b.travelDate ? new Date(b.travelDate) : null;
    if (b.customerBirthday !== undefined) {
      data.customerBirthday = b.customerBirthday ? new Date(b.customerBirthday) : null;
      if (b.customerBirthday) data.birthdayGreetedOn = null; // sana o'zgardi — qayta tabriklansin
    }
    const updated = await prisma.tourBooking.update({ where: { id: existing.id }, data, include: { tour: true, agency: true } });
    return success(res, { booking: formatBooking(updated) });
  } catch (err) {
    return error(res, (err.errors && err.errors[0] && err.errors[0].message) || err.message, 400);
  }
}

async function deleteTour(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    const existing = await prisma.tour.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!existing) return error(res, 'Tur topilmadi', 404);
    const bookingCount = await prisma.tourBooking.count({ where: { tourId: existing.id } });
    if (bookingCount > 0) {
      return error(res, 'Bu turda bronlar mavjud - ochirib bolmaydi. Uni tahrirlab yangilashingiz mumkin.', 409);
    }
    await prisma.tour.delete({ where: { id: existing.id } });
    return success(res, { deleted: true, id: existing.id });
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = {
  ensureApprovedAgency,
  register,
  verifyEmail,
  requestEmailChange,
  resendEmailChange,
  confirmEmailChange,
  login,
  me,
  changePassword,
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
  createManualLead,
  updatePipelineStage,
  setCustomerBirthday,
  updateLead,
  listReviews,
  setReviewStatus,
  deleteTour,
};
