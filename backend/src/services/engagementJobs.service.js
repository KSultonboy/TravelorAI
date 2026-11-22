// Engagement rejalashtirilgan ishlari (scheduler.service har 10 daqiqada chaqiradi).
// Har bir ish o'zi vaqtni (Toshkent) tekshiradi va idempotent — qayta ishga
// tushirish yoki server restart takroriy xabar yubormaydi.
const { runTrialReminders } = require('./trial.service');
const { runWeeklyDigests } = require('./weeklyDigest.service');

async function runEngagementJobs(now = new Date()) {
  const out = {};
  try { out.trial = await runTrialReminders(now); } catch (err) { out.trial = { error: err.message }; }
  try { out.digest = await runWeeklyDigests(now); } catch (err) { out.digest = { error: err.message }; }
  return out;
}

module.exports = { runEngagementJobs };
