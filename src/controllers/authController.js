const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const User = require("../models/User");
const { sendVerificationCode } = require("../config/email");

const devSecret = "reserv_dev_secret_2024_change_in_prod";

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || devSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const signTempToken = (id) =>
  jwt.sign({ id, temp: true }, process.env.JWT_SECRET || devSecret, {
    expiresIn: "5m",
  });

const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);
  res.status(statusCode).json({
    success: true,
    token,
    user,
  });
};

/**
 * POST /api/auth/register
 */
exports.register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const user = await User.create({ username, email, password });
    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    console.log("Login attempt for:", email);

    // Explicitly select password (hidden by default)
    const user = await User.findOne({ email }).select("+password");
    console.log("User found for login:", !!user);

    if (!user || !(await user.comparePassword(password))) {
      console.log("Login failed invalid credentials for:", email);
      return res.status(401).json({
        success: false,
        message: "Email ou mot de passe incorrect.",
      });
    }

    // Check if 2FA enabled
    if (user.twoFactorEnabled && user.otpSecret) {
      const tempToken = signTempToken(user._id);
      res.status(200).json({
        success: true,
        needs2fa: true,
        tempToken,
        user,
      });
      return;
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 */
exports.getMe = async (req, res, next) => {
  try {
    res.json({ success: true, user: req.user });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/avatar
 */
exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "Aucun fichier fourni." });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: req.file.filename },
      { new: true },
    );

    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/auth/me
 */
exports.deleteMe = async (req, res, next) => {
  try {
    await User.findByIdAndDelete(req.user._id);

    res.status(200).json({
      success: true,
      message: "Compte supprimé avec succès.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/verify-2fa
 * No protect - use tempToken
 */
exports.verify2FA = async (req, res, next) => {
  try {
    const { tempToken, otp } = req.body;

    if (!tempToken || !otp) {
      return res
        .status(400)
        .json({ success: false, message: "tempToken and otp required" });
    }

    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET || devSecret);

    const user = await User.findById(decoded.id).select(
      "+otpSecret +twoFactorEnabled",
    );

    if (!user || !user.twoFactorEnabled || !user.otpSecret) {
      return res
        .status(401)
        .json({ success: false, message: "User 2FA not enabled" });
    }

    const verified = speakeasy.totp.verify({
      secret: user.otpSecret,
      encoding: "base32",
      token: otp,
      window: 2,
    });

    if (verified) {
      sendTokenResponse(user, 200, res);
    } else {
      res.status(401).json({ success: false, message: "Code 2FA incorrect" });
    }
  } catch (error) {
    console.log("2FA verify error:", error.message);
    next(error);
  }
};

/**
 * POST /api/auth/setup-2fa - protect
 */
exports.setup2FA = async (req, res, next) => {
  try {
    const user = req.user;

    const secret = speakeasy.generateSecret({
      name: `Reserv (${user.email})`,
      issuer: "ReservApp",
      length: 32,
    });

    await User.findByIdAndUpdate(user._id, {
      otpSecret: secret.base32,
      twoFactorEnabled: false, // enable after verify
    });

    const otpauth_url = secret.otpauth_url;
    const qr = await QRCode.toDataURL(otpauth_url);

    res.json({
      success: true,
      base32: secret.base32,
      otpauth_url,
      qr,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/enable-2fa - protect
 */
exports.enable2FA = async (req, res, next) => {
  try {
    const { otp } = req.body;
    const user = req.user;

    if (!user.otpSecret) {
      return res
        .status(400)
        .json({ success: false, message: "No OTP secret. Setup first" });
    }

    const verified = speakeasy.totp.verify({
      secret: user.otpSecret,
      encoding: "base32",
      token: otp,
      window: 1,
    });

    if (verified) {
      await User.findByIdAndUpdate(user._id, { twoFactorEnabled: true });
      res.json({ success: true, message: "2FA enabled successfully!" });
    } else {
      res
        .status(400)
        .json({ success: false, message: "Verification code incorrect" });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/send-code
 */
exports.sendCode = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email requis" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Utilisateur non trouvé" });
    }

    // Générer un code à 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Sauvegarder le code et sa date d'expiration dans la base de données
    await User.findByIdAndUpdate(user._id, {
      emailVerificationCode: code,
      emailVerificationExpires: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    // Envoyer le code par email
    const emailSent = await sendVerificationCode(email, code);
    
    if (emailSent) {
      res.json({ 
        success: true, 
        message: "Code envoyé avec succès" 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: "Erreur lors de l'envoi du code" 
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/verify-code
 */
exports.verifyCode = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res
        .status(400)
        .json({ success: false, message: "Email et code requis" });
    }

    const user = await User.findOne({ 
      email,
      emailVerificationCode: code,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Code invalide ou expiré" });
    }

    // Effacer le code de vérification après utilisation
    await User.findByIdAndUpdate(user._id, {
      $unset: {
        emailVerificationCode: 1,
        emailVerificationExpires: 1
      }
    });

    // Envoyer le token JWT
    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};
