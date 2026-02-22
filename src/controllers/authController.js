const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
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

    // Explicitly select password (hidden by default)
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect.',
      });
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
      return res.status(400).json({ success: false, message: 'Aucun fichier fourni.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: req.file.filename },
      { new: true }
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
      message: 'Compte supprimé avec succès.',
    });
  } catch (error) {
    next(error);
  }
};
