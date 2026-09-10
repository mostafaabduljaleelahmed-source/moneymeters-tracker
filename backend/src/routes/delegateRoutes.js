const express = require('express');
const { listDelegates } = require('../controllers/tripController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/delegates -> قائمة كل المناديب مع حالة الاتصال
router.get('/', requireAuth, requireRole('admin'), listDelegates);

module.exports = router;
