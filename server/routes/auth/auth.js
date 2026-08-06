const express = require('express');
const router = express.Router();
const authController = require('../../controller/auth/auth');

router.post('/auth/login', authController.login);

module.exports = router;
