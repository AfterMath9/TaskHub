const express = require('express');
const { requireAuth } = require('../middleware/auth');
const categoryController = require('../controllers/categoryController');

const router = express.Router();
router.post('/', requireAuth, categoryController.create);
router.post('/:id', requireAuth, categoryController.rename);
router.post('/:id/delete', requireAuth, categoryController.remove);

module.exports = router;