const fs = require('fs');
const path = require('path');
const pool = require('./pool');

// يقرأ ملف schema.sql وينفذه على قاعدة البيانات المتصلة
async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    console.log('[MIGRATE] جاري تنفيذ schema.sql ...');
    await pool.query(sql);
    console.log('[MIGRATE] تم إنشاء/تحديث الجداول بنجاح');
    process.exit(0);
  } catch (err) {
    console.error('[MIGRATE] فشل التنفيذ:', err);
    process.exit(1);
  }
}

migrate();
