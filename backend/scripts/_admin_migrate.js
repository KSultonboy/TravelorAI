const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  await p.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'traveler'`);
  await p.$executeRawUnsafe(`ALTER TABLE "Feedback" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'new'`);
  console.log("columns ok");
})().then(() => process.exit(0)).catch((e) => { console.error("MIGRATE FAIL:", e.message); process.exit(1); });
