const { Pool } = require('pg');
const env = require('../config/env');

// Pool واحد يُعاد استخدامه في كل السيرفر بدل فتح اتصال جديد لكل Query
const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.pgSsl ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[DB] خطأ غير متوقع في اتصال قاعدة البيانات:', err);
});

module.exports = pool;
