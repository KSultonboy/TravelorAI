const { inferEntity, recordAudit } = require('../services/audit.service');
const { logger } = require('../config/logger');

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function agencyAuditMiddleware(req, res, next) {
  if (!MUTATING.has(req.method) || !req.agency?.id) return next();

  const startedAt = Date.now();
  res.once('finish', () => {
    if (res.statusCode >= 400) return;
    const { entityType, entityId } = inferEntity(req.originalUrl || req.path);
    recordAudit({
      agencyId: req.agency.id,
      actorAccountId: req.agencyAccount?.id,
      actorEmail: req.agencyAccount?.email,
      action: `${req.method} ${entityType || 'agency'}`,
      entityType,
      entityId: req.params?.id || entityId,
      requestPath: req.originalUrl || req.path,
      requestMethod: req.method,
      changes: { body: req.body || null, durationMs: Date.now() - startedAt, statusCode: res.statusCode },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    }).catch((err) => logger.error('AuditLog yozilmadi', { message: err.message }));
  });
  next();
}

module.exports = { agencyAuditMiddleware };
