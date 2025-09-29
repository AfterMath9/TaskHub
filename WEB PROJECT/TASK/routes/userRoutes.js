const express = require('express');
const { requireAuth } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();
router.get('/', requireAuth, userController.index);
router.post('/', requireAuth, userController.create);
router.post('/:id', requireAuth, userController.update);
router.post('/:id/delete', requireAuth, userController.remove);

module.exports = router;