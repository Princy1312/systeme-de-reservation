const express = require('express');
const router = express.Router();

const reservationController = require('../controllers/reservationController');
const { protect, restrictTo } = require('../middlewares/auth');
const { validateReservation } = require('../validators');
const upload = require('../config/multer');

// All routes require authentication
router.use(protect);

router.post('/check-availability', reservationController.checkAvailability);
router.get('/my', reservationController.getMyReservations);

router.get('/', restrictTo('admin'), reservationController.getAll);
router.get('/:id', reservationController.getOne);

router.post(
  '/',
  upload.single('attachment'),
  validateReservation,
  reservationController.create
);

router.put(
  '/:id',
  upload.single('attachment'),
  reservationController.update
);

router.patch('/:id/cancel', reservationController.cancel);
router.delete('/:id', restrictTo('admin'), reservationController.remove);

module.exports = router;
