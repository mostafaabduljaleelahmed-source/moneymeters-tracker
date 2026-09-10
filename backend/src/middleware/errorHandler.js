// Middleware مركزي لالتقاط أي خطأ غير متوقع في أي route ومنع كراش السيرفر
function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err);

  const status = err.status || 500;
  const message = err.expose ? err.message : 'حدث خطأ غير متوقع في السيرفر';

  res.status(status).json({ error: message });
}

// يلتقط أي Route غير موجود
function notFoundHandler(req, res) {
  res.status(404).json({ error: 'المسار غير موجود' });
}

module.exports = { errorHandler, notFoundHandler };
