const { prisma } = require('../config/database');
const { sendSupportFeedbackEmail } = require('../services/email.service');
const { success, error } = require('../utils/response');

async function create(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return error(res, 'Foydalanuvchi topilmadi.', 404);
    }

    const { category, subject, message, contactEmail, platform, appVersion } = req.body;

    await prisma.feedback.create({
      data: {
        userId: user.id,
        category: category || 'suggestion',
        subject: subject || null,
        message: String(message || ''),
        contactEmail: contactEmail || null,
        platform: platform || null,
        appVersion: appVersion || null,
      },
    });

    const delivery = await sendSupportFeedbackEmail({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      category,
      subject,
      message,
      contactEmail,
      platform,
      appVersion,
    });

    return success(
      res,
      {
        message: 'Fikr va murojaatingiz yuborildi. Rahmat!',
        delivery: delivery?.delivery || 'log',
      },
      201
    );
  } catch (err) {
    return error(res, err.message, 500);
  }
}

// Admin ro'yxati/o'chirish admin.controller.js ichida (/admin/feedback) — bu yerdagi
// marshrutsiz nusxalar olib tashlandi.
module.exports = { create };
