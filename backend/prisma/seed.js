/* eslint-disable no-console */
// Lokal ishlab chiqish uchun demo ma'lumotlar (idempotent — qayta ishga tushirish xavfsiz).
//
//   npm run db:seed
//
// Yaratadi / yangilaydi:
//   • 3 ta tarif (website/app/pricing/page.tsx bilan bir xil: Starter 99 000,
//     Pro 199 000, Premium 299 000 so'm)
//   • admin tasdiqlagan 1 ta demo agentlik + uning egasi (AgencyAccount)
//   • 3 ta demo tur: Samarqand, Buxoro, Xiva (narxlar so'mda)
//   • planner uchun 3 ta yo'nalish (Destination) va bir nechta POI
//
// Parol repoda YOZILMAYDI: birinchi ishga tushirishda tasodifiy yaratiladi va
// konsolga BIR MARTA chiqariladi. Qayta ishga tushirilsa parol o'zgarmaydi
// (SEED_RESET_PASSWORD=1 bo'lsa yangisi yaratiladi).
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const OWNER_EMAIL = String(process.env.SEED_AGENCY_EMAIL || 'demo-agency@travelorai.local').trim().toLowerCase();
const AGENCY_SLUG = 'ipak-yoli-demo-travel';

const TARIFFS = [
  {
    slug: 'starter', name: 'Starter', priceMonthly: 9, priceMonthlyUzs: 99000, sortOrder: 1,
    features: ['Lidlar va mijozlar bazasi', "Turlar va bronlar", "To'lovlar hisobi", 'CSV eksport'],
  },
  {
    slug: 'pro', name: 'Pro', priceMonthly: 19, priceMonthlyUzs: 199000, sortOrder: 2,
    features: ["Starter'dagi hammasi", 'Telegram bot va Instagram Direct', 'Hisobotlar va analitika', 'Dinamik takliflar', 'Ommaviy xabar yuborish'],
  },
  {
    // Saytda «Premium» nomi bilan, slug esa tarixiy `business`.
    slug: 'business', name: 'Premium', priceMonthly: 29, priceMonthlyUzs: 299000, sortOrder: 3,
    features: ["Pro'dagi hammasi", 'Jamoa, rollar va huquqlar', 'AI yordamchi', "Ustuvor qo'llab-quvvatlash"],
  },
];

const TOURS = [
  {
    slug: 'demo-samarqand-2-kun',
    title: 'Samarqand: Registon va Shohi Zinda — 2 kun',
    city: 'Samarqand',
    subtitle: "Afrosiyob poyezdida Toshkentdan, gid hamrohligida",
    description: "Ikki kunlik sayohatda Registon ansambli, Go'ri Amir maqbarasi, Bibixonim masjidi va Shohi Zinda majmuasini ko'rasiz. Kechqurun Registondagi yorug'lik shousi.",
    duration: '2 kun / 1 kecha', days: 2, nights: 1,
    price: "1 250 000 so'm", priceMin: 1250000,
    hotelName: 'Registan Plaza', hotelCategory: '4*', mealPlan: 'BB', mealPlanLabel: 'Nonushta',
    highlights: ['Registon ansambli', "Go'ri Amir", 'Shohi Zinda', 'Siyob bozori'],
    priceIncludes: ['Afrosiyob poyezd chiptasi (ikki tomon)', 'Mehmonxona (1 kecha)', 'Gid xizmati', 'Muzeylarga kirish'],
    priceExcludes: ['Tushlik va kechki ovqat', 'Shaxsiy xarajatlar'],
    itinerary: [
      { day: 1, title: 'Registon va markaz', places: [{ name: 'Registon', lat: 39.6547, lng: 66.9758 }, { name: "Go'ri Amir", lat: 39.6485, lng: 66.9690 }] },
      { day: 2, title: 'Shohi Zinda va bozor', places: [{ name: 'Shohi Zinda', lat: 39.6629, lng: 66.9874 }, { name: 'Siyob bozori', lat: 39.6610, lng: 66.9803 }] },
    ],
  },
  {
    slug: 'demo-buxoro-3-kun',
    title: 'Qadimiy Buxoro — 3 kun',
    city: 'Buxoro',
    subtitle: "Ark qal'asi, Poi Kalon va Lyabi Hovuz bo'ylab",
    description: "Buxoroning tarixiy markazi bo'ylab uch kunlik sayohat: Ark qal'asi, Poi Kalon majmuasi, Lyabi Hovuz, Sitorai Mohi Xosa saroyi va hunarmandlar rastalari.",
    duration: '3 kun / 2 kecha', days: 3, nights: 2,
    price: "1 900 000 so'm", priceMin: 1900000,
    hotelName: 'Lyabi House', hotelCategory: '3*', mealPlan: 'BB', mealPlanLabel: 'Nonushta',
    highlights: ["Ark qal'asi", 'Poi Kalon', 'Lyabi Hovuz', 'Sitorai Mohi Xosa'],
    priceIncludes: ['Poyezd chiptasi', 'Mehmonxona (2 kecha)', 'Gid xizmati', 'Transfer'],
    priceExcludes: ['Tushlik va kechki ovqat', 'Suvenirlar'],
    itinerary: [
      { day: 1, title: 'Ark va Registon maydoni', places: [{ name: "Ark qal'asi", lat: 39.7779, lng: 64.4110 }] },
      { day: 2, title: 'Poi Kalon va Lyabi Hovuz', places: [{ name: 'Poi Kalon', lat: 39.7757, lng: 64.4146 }, { name: 'Lyabi Hovuz', lat: 39.7738, lng: 64.4200 }] },
      { day: 3, title: 'Sitorai Mohi Xosa', places: [{ name: 'Sitorai Mohi Xosa', lat: 39.8094, lng: 64.4381 }] },
    ],
  },
  {
    slug: 'demo-xiva-2-kun',
    title: "Xiva: Ichan Qal'a — 2 kun",
    city: 'Xiva',
    subtitle: "Ochiq osmon ostidagi muzey-shahar",
    description: "Ichan Qal'a devorlari ichida ikki kun: Kalta Minor, Juma masjidi, Toshhovli saroyi va Islomxo'ja minorasi. Urganch aeroportidan transfer kiritilgan.",
    duration: '2 kun / 1 kecha', days: 2, nights: 1,
    price: "1 450 000 so'm", priceMin: 1450000,
    hotelName: 'Orient Star Khiva', hotelCategory: '3*', mealPlan: 'HB', mealPlanLabel: 'Nonushta va kechki ovqat',
    highlights: ["Ichan Qal'a", 'Kalta Minor', 'Juma masjidi', 'Toshhovli saroyi'],
    priceIncludes: ['Urganch aeroporti transferi', 'Mehmonxona (1 kecha)', 'Gid xizmati', "Ichan Qal'a chiptasi"],
    priceExcludes: ['Aviachipta', 'Shaxsiy xarajatlar'],
    itinerary: [
      { day: 1, title: "Ichan Qal'a", places: [{ name: 'Kalta Minor', lat: 41.3786, lng: 60.3594 }, { name: 'Juma masjidi', lat: 41.3789, lng: 60.3622 }] },
      { day: 2, title: 'Saroylar', places: [{ name: 'Toshhovli saroyi', lat: 41.3796, lng: 60.3637 }] },
    ],
  },
];

const DESTINATIONS = [
  {
    slug: 'samarqand', name: 'Samarqand', region: 'Samarqand viloyati',
    description: "Buyuk Ipak yo'lining markazi — Registon, Shohi Zinda va Bibixonim.",
    rating: 4.9, reviewCount: 0, categories: ['tarixiy', 'madaniy'], tags: ['registon', 'temuriylar'],
    budgetDaily: 350000, midDaily: 650000, luxuryDaily: 1400000,
    trainPrice: 270000, trainDuration: '2 soat 10 daqiqa', busPrice: 90000, busDuration: '4 soat',
    landmarks: [{ name: 'Registon', entryFee: 65000 }, { name: "Go'ri Amir", entryFee: 40000 }, { name: 'Shohi Zinda', entryFee: 40000 }],
    hotels: [{ name: 'Registan Plaza', price: 700000, type: 'mid' }],
    foodBudget: 120000, foodMid: 220000, foodLuxury: 450000,
    bestSeasons: ['bahor', 'kuz'], minDays: 1, maxDays: 3,
  },
  {
    slug: 'buxoro', name: 'Buxoro', region: 'Buxoro viloyati',
    description: "2500 yillik shahar — Ark qal'asi, Poi Kalon va Lyabi Hovuz.",
    rating: 4.8, reviewCount: 0, categories: ['tarixiy'], tags: ['ark', 'poi-kalon'],
    budgetDaily: 300000, midDaily: 600000, luxuryDaily: 1200000,
    trainPrice: 320000, trainDuration: '3 soat 50 daqiqa', busPrice: 120000, busDuration: '7 soat',
    landmarks: [{ name: "Ark qal'asi", entryFee: 50000 }, { name: 'Poi Kalon', entryFee: 0 }],
    hotels: [{ name: 'Lyabi House', price: 550000, type: 'mid' }],
    foodBudget: 100000, foodMid: 200000, foodLuxury: 400000,
    bestSeasons: ['bahor', 'kuz'], minDays: 1, maxDays: 3,
  },
  {
    slug: 'xiva', name: 'Xiva', region: 'Xorazm viloyati',
    description: "Ichan Qal'a — UNESCO ro'yxatidagi muzey-shahar.",
    rating: 4.8, reviewCount: 0, categories: ['tarixiy'], tags: ['ichan-qala'],
    budgetDaily: 280000, midDaily: 550000, luxuryDaily: 1100000,
    flightPrice: 900000, flightDuration: '1 soat 40 daqiqa',
    landmarks: [{ name: "Ichan Qal'a", entryFee: 150000 }, { name: 'Kalta Minor', entryFee: 0 }],
    hotels: [{ name: 'Orient Star Khiva', price: 600000, type: 'mid' }],
    foodBudget: 90000, foodMid: 180000, foodLuxury: 350000,
    bestSeasons: ['bahor', 'kuz'], minDays: 1, maxDays: 2,
  },
];

const POIS = [
  { slug: 'registon', name: 'Registon', city: 'Samarqand', type: 'landmark', lat: 39.6547, lng: 66.9758, price: 65000, info: "Uchta madrasadan iborat ansambl — Samarqandning ramzi." },
  { slug: 'gori-amir', name: "Go'ri Amir", city: 'Samarqand', type: 'landmark', lat: 39.6485, lng: 66.9690, price: 40000, info: 'Amir Temur va temuriylar maqbarasi.' },
  { slug: 'shohi-zinda', name: 'Shohi Zinda', city: 'Samarqand', type: 'landmark', lat: 39.6629, lng: 66.9874, price: 40000, info: 'XI–XIX asr maqbaralari majmuasi.' },
  { slug: 'ark-qalasi', name: "Ark qal'asi", city: 'Buxoro', type: 'landmark', lat: 39.7779, lng: 64.4110, price: 50000, info: 'Buxoro amirlarining qarorgohi.' },
  { slug: 'poi-kalon', name: 'Poi Kalon', city: 'Buxoro', type: 'landmark', lat: 39.7757, lng: 64.4146, price: 0, info: 'Minorai Kalon, masjid va Mir Arab madrasasi.' },
  { slug: 'lyabi-hovuz', name: 'Lyabi Hovuz', city: 'Buxoro', type: 'landmark', lat: 39.7738, lng: 64.4200, price: 0, info: 'XVII asr hovuzi atrofidagi ansambl.' },
  { slug: 'ichan-qala', name: "Ichan Qal'a", city: 'Xiva', type: 'landmark', lat: 41.3786, lng: 60.3600, price: 150000, info: "Devor bilan o'ralgan ichki shahar." },
  { slug: 'kalta-minor', name: 'Kalta Minor', city: 'Xiva', type: 'landmark', lat: 41.3786, lng: 60.3594, price: 0, info: 'Tugallanmagan moviy minora.' },
];

function assertNotProduction() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== '1') {
    console.error("Seed productionda ishga tushirilmaydi (NODE_ENV=production). To'xtatildi.");
    process.exit(1);
  }
}

async function seedTariffs() {
  const bySlug = {};
  for (const t of TARIFFS) {
    const data = {
      name: t.name, priceMonthly: t.priceMonthly, priceMonthlyUzs: t.priceMonthlyUzs,
      sortOrder: t.sortOrder, features: t.features.join(' | '), active: true,
    };
    bySlug[t.slug] = await prisma.tariff.upsert({ where: { slug: t.slug }, update: data, create: { slug: t.slug, ...data } });
  }
  return bySlug;
}

async function seedOwner() {
  const existing = await prisma.agencyAccount.findUnique({ where: { email: OWNER_EMAIL } });
  const resetPassword = process.env.SEED_RESET_PASSWORD === '1';
  let password = null;
  if (!existing || resetPassword) password = crypto.randomBytes(12).toString('base64url');

  const base = { emailVerified: true, emailVerifiedAt: new Date(), status: 'approved', mustChangePassword: false };
  const account = existing
    ? await prisma.agencyAccount.update({
        where: { id: existing.id },
        data: { ...base, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
      })
    : await prisma.agencyAccount.create({
        data: { email: OWNER_EMAIL, passwordHash: await bcrypt.hash(password, 10), ...base },
      });
  return { account, password };
}

async function seedAgency(account, tariff) {
  const now = new Date();
  const until = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const data = {
    ownerAccountId: account.id,
    accessMode: 'portal',
    name: "Ipak Yo'li Demo Travel",
    city: 'Toshkent',
    description: "Lokal ishlab chiqish uchun demo agentlik. O'zbekiston bo'ylab madaniy turlar.",
    specialty: 'Madaniy turlar, ichki turizm',
    phone: '+998 90 000 00 00',
    telegram: '@travelorai_demo',
    website: 'https://travelorai.com',
    active: true,
    source: 'seed',
    approvalStatus: 'approved',
    approvedAt: now,
    rejectedAt: null,
    tariffId: tariff ? tariff.id : null,
    subscriptionStatus: 'active',
    subscriptionUntil: until,
    toursCount: TOURS.length,
  };
  const agency = await prisma.tourAgency.upsert({
    where: { slug: AGENCY_SLUG },
    update: data,
    create: { slug: AGENCY_SLUG, ...data },
  });

  const application = await prisma.agencyApplication.findFirst({ where: { accountId: account.id } });
  const appData = {
    agencyId: agency.id,
    companyName: agency.name,
    contactPerson: 'Demo Menejer',
    phone: agency.phone,
    email: account.email,
    city: agency.city,
    country: "O'zbekiston",
    serviceTypes: ['Madaniy turlar'],
    description: agency.description,
    status: 'approved',
    submittedAt: now,
    reviewedAt: now,
  };
  if (application) await prisma.agencyApplication.update({ where: { id: application.id }, data: appData });
  else await prisma.agencyApplication.create({ data: { accountId: account.id, ...appData } });
  return agency;
}

async function seedTours(agency) {
  const now = new Date();
  for (const t of TOURS) {
    const data = {
      title: t.title, city: t.city, subtitle: t.subtitle, description: t.description,
      duration: t.duration, days: t.days, nights: t.nights,
      price: t.price, priceMin: t.priceMin, priceCurrency: 'UZS', priceBasis: 'kishi boshiga',
      rating: 4.8, badge: 'Popular',
      departureCity: 'Toshkent', destinationCountry: "O'zbekiston", tourGroup: 'Ichki turizm',
      hotelIncluded: true, hotelName: t.hotelName, hotelCategory: t.hotelCategory,
      mealPlan: t.mealPlan, mealPlanLabel: t.mealPlanLabel,
      transferIncluded: true, availabilityStatus: 'available',
      highlights: t.highlights, priceIncludes: t.priceIncludes, priceExcludes: t.priceExcludes,
      itinerary: t.itinerary,
      routeStops: t.itinerary.flatMap((d) => d.places),
      agencyId: agency.id, active: true, approvalStatus: 'approved', approvedAt: now, submittedAt: now,
      source: 'seed',
    };
    await prisma.tour.upsert({ where: { slug: t.slug }, update: data, create: { slug: t.slug, ...data } });
  }
}

async function seedPlannerData() {
  for (const d of DESTINATIONS) {
    const { slug, ...data } = d;
    await prisma.destination.upsert({
      where: { slug },
      update: { ...data, imageUrl: '', source: 'seed' },
      create: { slug, ...data, imageUrl: '', source: 'seed' },
    });
  }
  for (const p of POIS) {
    const data = { ...p, icon: 'pin', source: 'seed', confidenceScore: 0.8, rating: 4.8, landingActive: true };
    const found = await prisma.poi.findFirst({ where: { slug: p.slug, city: p.city }, select: { id: true } });
    if (found) await prisma.poi.update({ where: { id: found.id }, data });
    else await prisma.poi.create({ data });
  }
}

async function main() {
  assertNotProduction();
  const tariffs = await seedTariffs();
  const { account, password } = await seedOwner();
  const agency = await seedAgency(account, tariffs.business);
  await seedTours(agency);
  await seedPlannerData();

  console.log('\nSeed tayyor:');
  console.log(`  Tariflar: ${TARIFFS.map((t) => `${t.name} (${t.priceMonthlyUzs} so'm)`).join(', ')}`);
  console.log(`  Agentlik: ${agency.name} [${agency.slug}] — tasdiqlangan, Premium, 30 kun`);
  console.log(`  Turlar: ${TOURS.map((t) => t.city).join(', ')}`);
  console.log(`  Planner: ${DESTINATIONS.length} yo'nalish, ${POIS.length} POI`);
  console.log('\nAgentlik kabinetiga kirish (/agency):');
  console.log(`  Email:  ${account.email}`);
  if (password) {
    console.log(`  Parol:  ${password}`);
    console.log("  (Parol faqat hozir ko'rsatiladi — saqlab qo'ying. Yangisi: SEED_RESET_PASSWORD=1 npm run db:seed)");
  } else {
    console.log("  Parol:  o'zgarmadi (avvalgi seed'da chiqarilgan). Yangisi: SEED_RESET_PASSWORD=1 npm run db:seed");
  }
}

main()
  .catch((err) => {
    console.error('Seed xatosi:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
