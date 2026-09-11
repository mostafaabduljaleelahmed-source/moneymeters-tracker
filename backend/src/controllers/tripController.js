const TripModel = require('../models/tripModel');
const LocationModel = require('../models/locationModel');
const UserModel = require('../models/userModel');

// الرحلة النشطة الحالية للمندوب (تُستخدم لاستعادة حالة التتبع بعد Refresh)
async function getActiveTrip(req, res, next) {
  try {
    const trip = await TripModel.getActiveTrip(req.user.id);
    res.json({ trip: trip || null });
  } catch (err) {
    next(err);
  }
}

// بدء رحلة جديدة للمندوب الحالي (زر Start Trip)
async function startTrip(req, res, next) {
  try {
    const trip = await TripModel.startTrip(req.user.id);
    res.status(201).json({ trip });
  } catch (err) {
    next(err);
  }
}

// إنهاء الرحلة الحالية (زر End Trip)
async function endTrip(req, res, next) {
  try {
    const { tripId } = req.params;
    const trip = await TripModel.endTrip(tripId, req.user.id);
    if (!trip) return res.status(404).json({ error: 'الرحلة غير موجودة' });

    await UserModel.setOnlineStatus(req.user.id, false);
    const io = req.app.get('io');
    io.to('admins').emit('delegate:status', { userId: req.user.id, isOnline: false, at: new Date().toISOString() });

    res.json({ trip });
  } catch (err) {
    next(err);
  }
}

// قائمة كل المناديب مع حالة الاتصال (للـ Sidebar)
async function listDelegates(req, res, next) {
  try {
    const delegates = await UserModel.listDelegates();
    res.json({ delegates });
  } catch (err) {
    next(err);
  }
}

// كل رحلات مندوب معين (لعرض تاريخ الرحلات واختيار رحلة للـ Replay)
async function listTripsByDelegate(req, res, next) {
  try {
    const { delegateId } = req.params;
    const trips = await TripModel.listByDelegate(delegateId);
    res.json({ trips });
  } catch (err) {
    next(err);
  }
}

// مسار (Polyline) رحلة معينة بالكامل - يُستخدم في الخريطة والـ Replay
async function getTripRoute(req, res, next) {
  try {
    const { tripId } = req.params;
    const trip = await TripModel.findById(tripId);
    if (!trip) return res.status(404).json({ error: 'الرحلة غير موجودة' });

    const route = await LocationModel.getRouteByTrip(tripId);
    res.json({ trip, route });
  } catch (err) {
    next(err);
  }
}

module.exports = { getActiveTrip, startTrip, endTrip, listDelegates, listTripsByDelegate, getTripRoute };
