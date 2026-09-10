const jwt = require('jsonwebtoken');
const env = require('../config/env');

// يتحقق من الـ JWT الموجود في Authorization header ويضيف بيانات المستخدم للـ req
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'التوكن مطلوب' });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = payload; // { id, role, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'توكن غير صالح أو منتهي' });
  }
}

// يسمح فقط لأصحاب الدور المحدد (مثلاً admin) بالوصول
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'غير مصرح لك بهذا الإجراء' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
