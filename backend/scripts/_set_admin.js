const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
const email = String(process.argv[2] || "").trim().toLowerCase();
(async () => {
  if (!email) { console.log("no email arg"); return; }
  const r = await p.user.updateMany({ where: { email }, data: { role: "admin" } });
  console.log("admin set count:", r.count, "for", email);
})().then(() => process.exit(0)).catch((e) => { console.error("SETADMIN FAIL:", e.message); process.exit(1); });
