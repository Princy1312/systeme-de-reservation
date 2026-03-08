const User = require("../models/User");
const Resource = require("../models/Resource");
const Reservation = require("../models/Reservation");

/**
 * GET /api/admin/dashboard
 * Statistiques du dashboard
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments({ role: "user" });
    const totalResources = await Resource.countDocuments();
    const availableResources = await Resource.countDocuments({
      available: true,
    });
    const totalReservations = await Reservation.countDocuments();
    const resourcesByType = await Resource.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);

    const recentUsers = await User.find({ role: "user" })
      .sort("-createdAt")
      .limit(5)
      .select("username email createdAt");

    const recentResources = await Resource.find().sort("-createdAt").limit(5);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalResources,
          totalReservations,
          availableResources,
          resourcesByType,
        },
        recentUsers,
        recentResources,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/users
 * Liste des utilisateurs avec pagination
 */
exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, role } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (role) filter.role = role;

    const users = await User.find(filter)
      .select("-password")
      .sort("-createdAt")
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/users/:id
 * Supprimer un utilisateur
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Utilisateur introuvable." });
    }

    if (user.role === "admin") {
      return res.status(400).json({
        success: false,
        message: "Impossible de supprimer un administrateur.",
      });
    }

    res.json({ success: true, message: "Utilisateur supprimé avec succès." });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/users/:id/role
 * Modifier le rôle d'un utilisateur
 */
exports.updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;

    if (!["user", "admin"].includes(role)) {
      return res
        .status(400)
        .json({ success: false, message: "Rôle invalide." });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Utilisateur introuvable." });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/resources
 * Liste des ressources pour l'admin
 */
exports.getResources = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, type, available, search } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (type) filter.type = type;
    if (available !== undefined) filter.available = available === "true";
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const resources = await Resource.find(filter)
      .sort("-createdAt")
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Resource.countDocuments(filter);

    res.json({
      success: true,
      data: resources,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};
