const express = require('express');
const { receiveLocation } = require('../controllers/locationController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// المندوب فقط (مسجل دخول) يقدر يرسل موقعه
router.post('/', requireAuth, receiveLocation);

module.exports = router;
