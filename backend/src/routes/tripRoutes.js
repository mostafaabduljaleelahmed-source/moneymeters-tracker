const express = require('express');
const {
  startTrip,
  endTrip,
  listTripsByDelegate,
  getTripRoute,
} = require('../controllers/tripController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// المندوب: بدء/إنهاء رحلة
router.post('/start', requireAuth, requireRole('delegate'), startTrip);
router.post('/:tripId/end', requireAuth, requireRole('delegate'), endTrip);

// GET /api/trips/:delegateId  -> كل رحلات مندوب معين
router.get('/:delegateId', requireAuth, requireRole('admin'), listTripsByDelegate);

// GET /api/trips/:tripId/route -> مسار رحلة معينة (Polyline)
router.get('/:tripId/route', requireAuth, getTripRoute);

module.exports = router;
