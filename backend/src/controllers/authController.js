const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');
const env = require('../config/env');

// تسجيل دخول بالإيميل والباسورد - يرجع JWT
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'الإيميل وكلمة المرور مطلوبين' });
    }

    const user = await UserModel.findByEmail(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, name: user.name, vehicleType: user.vehicle_type },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, vehicleType: user.vehicle_type },
    });
  } catch (err) {
    next(err);
  }
}

// إنشاء مستخدم جديد (مندوب أو مدير) - يُستخدم عادة من لوحة الإدارة فقط
async function register(req, res, next) {
  try {
    const { name, email, password, role, phone, vehicleType } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'الاسم والإيميل وكلمة المرور مطلوبين' });
    }

    const existing = await UserModel.findByEmail(email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ error: 'الإيميل مستخدم بالفعل' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await UserModel.create({
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role === 'admin' ? 'admin' : 'delegate',
      phone,
      vehicleType: ['car', 'motorcycle', 'walking'].includes(vehicleType) ? vehicleType : 'car',
    });

    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, vehicleType: user.vehicle_type },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, register };
