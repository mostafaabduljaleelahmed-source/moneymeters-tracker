const pool = require('../db/pool');

const LocationModel = {
  async insert({ userId, tripId, lat, lng, speed, heading, accuracy }) {
    const { rows } = await pool.query(
      `INSERT INTO locations (user_id, trip_id, lat, lng, speed, heading, accuracy)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, tripId, lat, lng, speed || 0, heading || null, accuracy || null]
    );
    return rows[0];
  },

  async getLastLocation(userId) {
    const { rows } = await pool.query(
      `SELECT * FROM locations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  },

  // كل نقاط رحلة معينة مرتبة زمنيًا - تُستخدم لرسم الـ Polyline وشاشة الـ Replay
  async getRouteByTrip(tripId) {
    const { rows } = await pool.query(
      `SELECT id, lat, lng, speed, heading, accuracy, created_at
       FROM locations WHERE trip_id = $1 ORDER BY created_at ASC`,
      [tripId]
    );
    return rows;
  },

  // المسافة بين آخر نقطتين باستخدام PostGIS (بالمتر) - تستخدم لتحديث المسافة الكلية للرحلة
  async distanceBetweenLastTwo(tripId) {
    const { rows } = await pool.query(
      `SELECT ST_Distance(
          geom::geography,
          LAG(geom) OVER (ORDER BY created_at)::geography
        ) AS distance_m
       FROM locations WHERE trip_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [tripId]
    );
    return rows[0]?.distance_m || 0;
  },
};

module.exports = LocationModel;
