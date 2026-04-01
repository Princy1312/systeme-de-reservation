const express = require('express');
const router = express.Router();

const resourceController = require('../controllers/resourceController');
const { protect, restrictTo } = require('../middlewares/auth');
const { validateResource } = require('../validators');
const upload = require('../config/multer');

// Public
router.get('/', resourceController.getAll);
router.get('/:id', resourceController.getOne);
router.get('/:id/availability', resourceController.getAvailability);

// Admin only
router.post(
  '/',
  protect,
  restrictTo('admin'),
  upload.single('image'),
  validateResource,
  resourceController.create
);

router.put(
  '/:id',
  protect,
  restrictTo('admin'),
  upload.single('image'),
  validateResource,
  resourceController.update
);

router.delete('/:id', protect, restrictTo('admin'), resourceController.remove);

module.exports = router;
