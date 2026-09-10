const pool = require('../db/pool');
const env = require('../config/env');

// كاش بسيط في الذاكرة لتتبع آخر مرة اتبعت فيها تنبيه توقف/خروج لكل مندوب
// (عشان منبعتش نفس التنبيه كل 10 ثواني)
const lastIdleAlertAt = new Map();
const lastGeofenceAlertAt = new Map();
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 دقائق بين كل تنبيه ومثله

// يحسب المسافة بين نقطتين بالمتر (Haversine) بدون الحاجة لاستعلام DB إضافي
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function insertAlert({ userId, tripId, type, message }) {
  await pool.query(
    `INSERT INTO alerts (user_id, trip_id, type, message) VALUES ($1, $2, $3, $4)`,
    [userId, tripId || null, type, message]
  );
}

// فحص: هل المندوب واقف أكتر من IDLE_ALERT_MINUTES (سرعة قريبة من صفر لفترة طويلة)
// وهل هو خارج نطاق الـ Geofence المحدد له أو للنطاق العام
async function checkGeofenceAndIdle({ io, userId, tripId, lat, lng, speed }) {
  const now = Date.now();

  // ---------- فحص التوقف الطويل ----------
  if ((speed || 0) < 0.5) {
    const { rows } = await pool.query(
      `SELECT created_at FROM locations
       WHERE user_id = $1 AND speed >= 0.5
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    const lastMovingAt = rows[0]?.created_at ? new Date(rows[0].created_at).getTime() : null;
    const idleMinutes = lastMovingAt ? (now - lastMovingAt) / 60000 : Infinity;

    if (idleMinutes >= env.idleAlertMinutes) {
      const last = lastIdleAlertAt.get(userId) || 0;
      if (now - last > ALERT_COOLDOWN_MS) {
        lastIdleAlertAt.set(userId, now);
        const message = `المندوب متوقف منذ أكثر من ${env.idleAlertMinutes} دقيقة`;
        await insertAlert({ userId, tripId, type: 'idle', message });
        io.to('admins').emit('alert:idle', { userId, tripId, message, at: new Date().toISOString() });
      }
    }
  }

  // ---------- فحص الخروج عن نطاق الـ Geofence ----------
  const { rows: fences } = await pool.query(
    `SELECT * FROM geofences WHERE user_id = $1 OR user_id IS NULL`,
    [userId]
  );

  for (const fence of fences) {
    const distance = haversineMeters(lat, lng, fence.center_lat, fence.center_lng);
    if (distance > fence.radius_m) {
      const key = `${userId}_${fence.id}`;
      const last = lastGeofenceAlertAt.get(key) || 0;
      if (now - last > ALERT_COOLDOWN_MS) {
        lastGeofenceAlertAt.set(key, now);
        const message = `المندوب خرج عن نطاق "${fence.name}"`;
        await insertAlert({ userId, tripId, type: 'geofence_exit', message });
        io.to('admins').emit('alert:geofence', {
          userId,
          tripId,
          fenceId: fence.id,
          message,
          at: new Date().toISOString(),
        });
      }
    }
  }
}

module.exports = { checkGeofenceAndIdle };
