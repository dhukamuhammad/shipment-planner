const express = require('express');
const router = express.Router();
const { getActivityLogs } = require('../../controller/activity/activity');
const { verifyToken, isAdmin } = require('../../middleware/auth');

// Only Super Admin can view activity logs
router.get('/', verifyToken, isAdmin, getActivityLogs);

module.exports = router;
