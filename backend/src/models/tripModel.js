const pool = require('../db/pool');

const TripModel = {
  async startTrip(userId) {
    // اقفل أي رحلة قديمة لسه شغالة لنفس المندوب (احتياط لو التطبيق قفل بغلط)
    await pool.query(
      `UPDATE trips SET status = 'ended', ended_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    const { rows } = await pool.query(
      `INSERT INTO trips (user_id) VALUES ($1) RETURNING *`,
      [userId]
    );
    return rows[0];
  },

  async endTrip(tripId, userId) {
    const { rows } = await pool.query(
      `UPDATE trips SET status = 'ended', ended_at = NOW()
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [tripId, userId]
    );
    return rows[0] || null;
  },

  async getActiveTrip(userId) {
    const { rows } = await pool.query(
      `SELECT * FROM trips WHERE user_id = $1 AND status = 'active'
       ORDER BY started_at DESC LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  },

  async addDistance(tripId, meters) {
    await pool.query(`UPDATE trips SET distance_m = distance_m + $1 WHERE id = $2`, [meters, tripId]);
  },

  // تاريخ كل رحلات مندوب معين
  async listByDelegate(userId) {
    const { rows } = await pool.query(
      `SELECT * FROM trips WHERE user_id = $1 ORDER BY started_at DESC`,
      [userId]
    );
    return rows;
  },

  async findById(tripId) {
    const { rows } = await pool.query(`SELECT * FROM trips WHERE id = $1`, [tripId]);
    return rows[0] || null;
  },
};

module.exports = TripModel;
