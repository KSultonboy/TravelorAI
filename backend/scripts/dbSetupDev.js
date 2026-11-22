/* eslint-disable no-console */
// BO'SH lokal ma'lumotlar bazasini noldan tayyorlaydi (faqat ishlab chiqish uchun).
//
//   npm run db:setup:dev            # schema + migratsiyalarni "applied" deb belgilash
//   npm run db:setup:dev -- --seed  # + demo ma'lumotlar (prisma/seed.js)
//
// Nega kerak: prisma/migrations tarixi to'liq emas — 13 ta jadval faqat
// prisma/manual-migrations'da, TelegramMessage uchun esa CREATE TABLE umuman
// yo'q. Shuning uchun toza bazada `prisma migrate deploy` ishlamaydi. Mavjud
// migratsiyalarni o'zgartirib bo'lmaydi (production `_prisma_migrations`
// jadvali ularga havola qiladi). Yechim:
//   1) `prisma db push` — joriy schema.prisma'dan bazani yaratadi;
//   2) har bir migratsiya papkasi `prisma migrate resolve --applied` bilan
//      bajarilgan deb belgilanadi — keyingi `migrate deploy` faqat yangilarini qo'llaydi.
//
// Xavfsizlik: NODE_ENV=production bo'lsa, bazada allaqachon jadval bo'lsa yoki
// DATABASE_URL lokal bo'lmasa (--allow-remote siz) — ishlamaydi.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'prisma', 'migrations');
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'postgres', 'db', 'host.docker.internal']);

function fail(message) {
  console.error(`\n[db:setup:dev] ${message}`);
  process.exit(1);
}

function prismaCli(args) {
  const cli = require.resolve('prisma/build/index.js', { paths: [ROOT] });
  console.log(`\n$ prisma ${args.join(' ')}`);
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: ROOT, stdio: 'inherit', env: process.env });
  if (result.status !== 0) fail(`prisma ${args[0]} ${args[1] || ''} xato bilan tugadi (kod ${result.status}).`);
}

function migrationFolders() {
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(MIGRATIONS_DIR, entry.name, 'migration.sql')))
    .map((entry) => entry.name)
    .sort();
}

async function countTables() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'"
    );
    return Number(rows?.[0]?.n || 0);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (process.env.NODE_ENV === 'production') fail('NODE_ENV=production — bu skript faqat lokal ishlab chiqish uchun.');

  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL o'rnatilmagan (backend/.env).");
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { fail('DATABASE_URL yaroqsiz.'); }
  if (!LOCAL_HOSTS.has(host) && !args.has('--allow-remote')) {
    fail(`DATABASE_URL lokal emas (${host}). Masofaviy bazada ishlatmang; aniq bilsangiz --allow-remote qo'shing.`);
  }

  const tables = await countTables().catch((err) => fail(`Bazaga ulanib bo'lmadi: ${err.message}`));
  if (tables > 0) {
    fail(`Bazada allaqachon ${tables} ta jadval bor. Skript faqat BO'SH baza uchun — mavjud bazada \`npx prisma migrate deploy\` ishlating.`);
  }

  // 1) Joriy schema.prisma'dan jadvallar
  prismaCli(['db', 'push', '--skip-generate']);

  // 2) Migratsiya tarixini "bajarilgan" deb belgilash
  const folders = migrationFolders();
  for (const name of folders) prismaCli(['migrate', 'resolve', '--applied', name]);

  // 3) Prisma Client (schema o'zgargan bo'lishi mumkin)
  prismaCli(['generate']);

  if (args.has('--seed')) {
    console.log('\n$ node prisma/seed.js');
    const seed = spawnSync(process.execPath, [path.join(ROOT, 'prisma', 'seed.js')], { cwd: ROOT, stdio: 'inherit', env: process.env });
    if (seed.status !== 0) fail('Seed xato bilan tugadi.');
  }

  console.log(`\n[db:setup:dev] Tayyor: schema qo'llandi, ${folders.length} ta migratsiya "applied" deb belgilandi.`);
  if (!args.has('--seed')) console.log('Demo ma\'lumot uchun: npm run db:seed');
}

main().catch((err) => fail(err.stack || err.message));
