const LocationModel = require('../models/locationModel');
const TripModel = require('../models/tripModel');
const { checkGeofenceAndIdle } = require('../sockets/alerts');

// يستقبل موقع من تطبيق المندوب، يخزنه، ويبثه عبر Socket.io للداشبورد
async function receiveLocation(req, res, next) {
  try {
    const userId = req.user.id;
    const { lat, lng, speed, heading, accuracy, tripId, timestamp } = req.body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'lat و lng مطلوبين كأرقام' });
    }

    // تأكيد أن الرحلة فعلاً نشطة وتخص نفس المستخدم
    let activeTripId = tripId;
    if (activeTripId) {
      const trip = await TripModel.findById(activeTripId);
      if (!trip || trip.user_id !== userId || trip.status !== 'active') {
        return res.status(400).json({ error: 'الرحلة غير صالحة أو منتهية' });
      }
    }

    const location = await LocationModel.insert({
      userId,
      tripId: activeTripId || null,
      lat,
      lng,
      speed,
      heading,
      accuracy,
    });

    if (activeTripId) {
      const distance = await LocationModel.distanceBetweenLastTwo(activeTripId);
      if (distance && distance > 0) {
        await TripModel.addDistance(activeTripId, distance);
      }
    }

    // بث الموقع مباشرة لأي مدير مفتوح صفحة المندوب ده (Socket room: delegate_<id>)
    const io = req.app.get('io');
    io.to(`delegate_${userId}`).emit('location:update', {
      userId,
      tripId: activeTripId || null,
      lat,
      lng,
      speed: speed || 0,
      heading: heading || null,
      vehicle: req.user.vehicleType || 'car',
      timestamp: timestamp || location.created_at,
    });

    // فحص التنبيهات (توقف طويل / خروج عن النطاق) بدون ما نعطل الرد على المندوب
    checkGeofenceAndIdle({ io, userId, tripId: activeTripId, lat, lng, speed }).catch((err) =>
      console.error('[ALERTS] فشل فحص التنبيهات:', err)
    );

    res.status(201).json({ ok: true, location });
  } catch (err) {
    next(err);
  }
}

module.exports = { receiveLocation };
