const express = require('express');
const { nonEmpty } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const taskController = require('../controllers/taskController');

const router = express.Router();
router.get('/:id', requireAuth, taskController.detail);
router.post('/', requireAuth, nonEmpty('title'), taskController.create);
router.post('/:id/toggle', requireAuth, taskController.toggle);
router.post('/:id', requireAuth, nonEmpty('title'), taskController.update);
router.post('/:id/delete', requireAuth, taskController.remove);

module.exports = router;