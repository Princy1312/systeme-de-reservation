const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Protect routes — verify JWT token
 */
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Accès non autorisé. Veuillez vous connecter.",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "reserv_dev_secret_2024_change_in_prod",
    );
    const user = await User.findById(decoded.id);
    console.log("User loaded from token:", !!user);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "L'utilisateur associé à ce token n'existe plus.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log(
      "JWT protect error:",
      error.message,
      token ? `Token:${token.slice(0, 20)}...` : "no token",
    );
    return res.status(401).json({
      success: false,
      message: "Token invalide ou expiré.",
    });
  }
};

/**
 * Restrict access to admin role only
 */
const restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Vous n'avez pas la permission d'effectuer cette action.",
      });
    }
    next();
  };

module.exports = { protect, restrictTo };
