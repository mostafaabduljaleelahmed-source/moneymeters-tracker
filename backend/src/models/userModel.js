const pool = require('../db/pool');

const UserModel = {
  async findByEmail(email) {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async create({ name, email, passwordHash, role = 'delegate', phone = null, vehicleType = 'car' }) {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, phone, vehicle_type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, email, passwordHash, role, phone, vehicleType]
    );
    return rows[0];
  },

  async setOnlineStatus(userId, isOnline) {
    await pool.query(
      `UPDATE users SET is_online = $1, last_seen_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [isOnline, userId]
    );
  },

  // كل المناديب مع حالة الاتصال الحالية (للـ Sidebar في الداشبورد)
  async listDelegates() {
    const { rows } = await pool.query(
      `SELECT id, name, email, phone, vehicle_type, is_online, last_seen_at
       FROM users WHERE role = 'delegate' ORDER BY name ASC`
    );
    return rows;
  },
};

module.exports = UserModel;
