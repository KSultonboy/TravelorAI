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

async function getAll(req, res) {
  try {
    const { category, page = '1', limit = '20' } = req.query;
    const parsedPage = Math.max(1, parseInt(String(page), 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));

    const where = {};
    if (category) where.category = String(category);

    const [items, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (parsedPage - 1) * parsedLimit,
        take: parsedLimit,
      }),
      prisma.feedback.count({ where }),
    ]);

    return success(res, { items, total, page: parsedPage, limit: parsedLimit });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function remove(req, res) {
  try {
    const existing = await prisma.feedback.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Topilmadi', 404);
    await prisma.feedback.delete({ where: { id: req.params.id } });
    return success(res, { id: req.params.id });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

module.exports = { create, getAll, remove };
