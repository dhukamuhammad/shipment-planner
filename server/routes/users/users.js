const express = require('express');
const router = express.Router();
const usersController = require('../../controller/users/users');
const { verifyToken, isAdmin } = require('../../middleware/auth');

router.post('/users/create', verifyToken, isAdmin, usersController.createUser);
router.get('/users', verifyToken, isAdmin, usersController.getUsers);
router.put('/users/:id', verifyToken, isAdmin, usersController.updateUser);
router.delete('/users/:id', verifyToken, isAdmin, usersController.deleteUser);
router.post('/users/:id/mark-logs-read', verifyToken, isAdmin, usersController.markLogsAsRead);
router.put('/users/:id/toggle-block', verifyToken, isAdmin, usersController.toggleBlockUser);

module.exports = router;
