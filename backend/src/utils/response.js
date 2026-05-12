exports.success = (res, data, statusCode = 200) =>
  res.status(statusCode).json({ success: true, data });

exports.error = (res, message, statusCode = 400, extra = {}) =>
  res.status(statusCode).json({ success: false, message, ...extra });
