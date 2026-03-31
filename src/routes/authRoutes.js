const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const { protect } = require("../middlewares/auth");
const { validateRegister, validateLogin } = require("../validators");
const upload = require("../config/multer");

router.post("/register", /* validateRegister, */ authController.register);
router.post("/login", validateLogin, authController.login);
router.get("/me", protect, authController.getMe);
router.put(
  "/avatar",
  protect,
  upload.single("avatar"),
  authController.uploadAvatar,
);
router.post("/verify-2fa", authController.verify2FA);
router.post("/setup-2fa", protect, authController.setup2FA);
router.post("/enable-2fa", protect, authController.enable2FA);
router.delete("/me", protect, authController.deleteMe);

module.exports = router;
