const express = require('express');
const { login, register } = require('../controllers/authController');

const router = express.Router();

router.post('/login', login);
router.post('/register', register); // ينفع تقفله في الإنتاج ويتحول لمسار admin فقط

module.exports = router;
