const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const { validateRegister, validateLogin } = require('../validators');
const upload = require('../config/multer');

router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.get('/me', protect, authController.getMe);
router.put('/avatar', protect, upload.single('avatar'), authController.uploadAvatar);
router.delete('/me', protect, authController.deleteMe);

module.exports = router;
