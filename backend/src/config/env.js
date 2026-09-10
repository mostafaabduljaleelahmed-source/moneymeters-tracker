require('dotenv').config();

// تجميع كل متغيرات البيئة في مكان واحد مع قيم افتراضية آمنة
module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  pgSsl: process.env.PGSSL === 'true',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  idleAlertMinutes: Number(process.env.IDLE_ALERT_MINUTES || 15),
  defaultGeofenceRadiusM: Number(process.env.DEFAULT_GEOFENCE_RADIUS_M || 1000),
};

if (!process.env.JWT_SECRET) {
  console.warn('[WARN] JWT_SECRET غير موجود في .env - استخدم قيمة افتراضية غير آمنة للتطوير فقط');
}
