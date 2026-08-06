const express = require('express');
const router = express.Router();
const usersController = require('../../controller/users/users');
const { verifyToken, isAdmin } = require('../../middleware/auth');

router.post('/users/create', verifyToken, isAdmin, usersController.createUser);
router.get('/users', verifyToken, isAdmin, usersController.getUsers);
router.put('/users/:id', verifyToken, isAdmin, usersController.updateUser);
router.delete('/users/:id', verifyToken, isAdmin, usersController.deleteUser);

module.exports = router;
