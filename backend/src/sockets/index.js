const jwt = require('jsonwebtoken');
const env = require('../config/env');
const UserModel = require('../models/userModel');

// إعداد كل منطق Socket.io: مصادقة الاتصال، انضمام الغرف، وتتبع الأونلاين/الأوفلاين
function initSockets(io) {
  // Middleware للتحقق من الـ JWT عند كل اتصال Socket جديد
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('التوكن مطلوب'));

      const payload = jwt.verify(token, env.jwtSecret);
      socket.user = payload;
      next();
    } catch (err) {
      next(new Error('توكن غير صالح'));
    }
  });

  io.on('connection', async (socket) => {
    const { id: userId, role } = socket.user;

    if (role === 'admin') {
      // المدير ينضم لغرفة عامة يستقبل فيها كل التنبيهات
      socket.join('admins');
    } else {
      // المندوب أونلاين - حدّث حالته وبلّغ كل المديرين
      await UserModel.setOnlineStatus(userId, true);
      socket.join(`delegate_${userId}`);
      io.to('admins').emit('delegate:status', { userId, isOnline: true, at: new Date().toISOString() });
    }

    // المدير يطلب متابعة مندوب معين (Multi-tracking) - ينضم لغرفته
    socket.on('watch:delegate', (delegateId) => {
      if (role === 'admin' && delegateId) {
        socket.join(`delegate_${delegateId}`);
      }
    });

    socket.on('unwatch:delegate', (delegateId) => {
      if (role === 'admin' && delegateId) {
        socket.leave(`delegate_${delegateId}`);
      }
    });

    socket.on('disconnect', async () => {
      if (role !== 'admin') {
        await UserModel.setOnlineStatus(userId, false);
        io.to('admins').emit('delegate:status', { userId, isOnline: false, at: new Date().toISOString() });
      }
    });
  });
}

module.exports = initSockets;
