// Test agentlik yaratadi (AgencyAccount + TourAgency, approved). Idempotent.
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const p = new PrismaClient();

const EMAIL = (process.argv[2] || "testagency@travelorai.com").trim().toLowerCase();
const PASSWORD = process.argv[3] || "Test12345";
const SLUG = "test-agency";

(async () => {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const now = new Date();

  // 1) Account (login = email)
  const account = await p.agencyAccount.upsert({
    where: { email: EMAIL },
    update: { passwordHash, status: "approved", emailVerified: true, emailVerifiedAt: now },
    create: { email: EMAIL, passwordHash, status: "approved", emailVerified: true, emailVerifiedAt: now },
  });

  // 2) TourAgency (approved, linked to account)
  const existing = await p.tourAgency.findUnique({ where: { slug: SLUG } });
  if (existing) {
    await p.tourAgency.update({
      where: { slug: SLUG },
      data: { ownerAccountId: account.id, active: true, approvalStatus: "approved", approvedAt: now },
    });
  } else {
    await p.tourAgency.create({
      data: {
        slug: SLUG,
        ownerAccountId: account.id,
        name: "Test Agency",
        city: "Toshkent",
        specialty: "Sayohat turlari",
        active: true,
        approvalStatus: "approved",
        approvedAt: now,
        source: "admin",
      },
    });
  }

  console.log("OK — test agency ready");
  console.log("  login (email):", EMAIL);
  console.log("  password     :", PASSWORD);
  console.log("  accountId    :", account.id);
})()
  .then(() => process.exit(0))
  .catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
