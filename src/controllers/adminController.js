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
 * GET /api/admin/users/:id
 * Obtenir un utilisateur spécifique
 */
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur introuvable.",
      });
    }

    res.json({
      success: true,
      data: user,
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
      total,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/resources/:id
 * Obtenir une ressource spécifique
 */
exports.getResourceById = async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id);
    
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: "Ressource introuvable.",
      });
    }

    res.json({
      success: true,
      data: resource,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/resources
 * Créer une nouvelle ressource
 */
exports.createResource = async (req, res, next) => {
  try {
    const { name, type, capacity, pricePerHour, description, available } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        success: false,
        message: "Le nom et le type sont obligatoires.",
      });
    }

    const resource = await Resource.create(req.body);
    
    // Créer une notification pour la nouvelle ressource
    const notification = {
      title: "Nouvelle ressource ajoutée",
      message: `La ressource "${resource.name}" a été ajoutée avec succès`,
      type: "resource",
      read: false,
      createdAt: new Date(),
      _id: new Date().getTime() // ID temporaire pour le frontend
    };

    res.status(201).json({
      success: true,
      message: "Ressource créée avec succès.",
      data: resource,
      notification // Envoyer la notification au frontend
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/resources/:id
 * Mettre à jour une ressource
 */
exports.updateResource = async (req, res, next) => {
  try {
    const { name, type, capacity, pricePerHour, description, available } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        success: false,
        message: "Le nom et le type sont obligatoires.",
      });
    }

    const resource = await Resource.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: "Ressource introuvable.",
      });
    }

    // Créer une notification pour la ressource modifiée
    const notification = {
      title: "Ressource modifiée",
      message: `La ressource "${resource.name}" a été modifiée avec succès`,
      type: "resource",
      read: false,
      createdAt: new Date(),
      _id: new Date().getTime() // ID temporaire pour le frontend
    };

    res.json({
      success: true,
      message: "Ressource mise à jour avec succès.",
      data: resource,
      notification // Envoyer la notification au frontend
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/resources/:id
 * Supprimer une ressource
 */
exports.deleteResource = async (req, res, next) => {
  try {
    const resource = await Resource.findByIdAndDelete(req.params.id);

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: "Ressource introuvable.",
      });
    }

    res.json({
      success: true,
      message: "Ressource supprimée avec succès.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/reservations
 * Liste des réservations pour l'admin
 */
exports.getReservations = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (search) {
      filter.$or = [
        { "user.name": { $regex: search, $options: "i" } },
        { "user.username": { $regex: search, $options: "i" } },
        { "resource.name": { $regex: search, $options: "i" } },
      ];
    }
    if (status) filter.status = status;

    const reservations = await Reservation.find(filter)
      .populate("user", "name username email")
      .populate("resource", "name type")
      .sort("-createdAt")
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Reservation.countDocuments(filter);

    res.json({
      success: true,
      data: reservations,
      total,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/reservations/:id/confirm
 * Confirmer une réservation
 */
exports.confirmReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { status: "confirmed" },
      { new: true, runValidators: true }
    ).populate("user", "name username email");

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Réservation introuvable.",
      });
    }

    res.json({
      success: true,
      message: "Réservation confirmée avec succès.",
      data: reservation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/reservations/:id/cancel
 * Annuler une réservation
 */
exports.cancelReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { status: "cancelled" },
      { new: true, runValidators: true }
    ).populate("user", "name username email");

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Réservation introuvable.",
      });
    }

    res.json({
      success: true,
      message: "Réservation annulée avec succès.",
      data: reservation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/reservations/:id
 * Supprimer une réservation
 */
exports.deleteReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findByIdAndDelete(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Réservation introuvable.",
      });
    }

    res.json({
      success: true,
      message: "Réservation supprimée avec succès.",
      data: reservation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/notifications
 * Obtenir les notifications admin
 */
exports.getNotifications = async (req, res, next) => {
  try {
    // Récupérer toutes les réservations récentes (pas seulement pending)
    const recentReservations = await Reservation.find({})
      .populate("user", "name username")
      .populate("resource", "name")
      .sort("-createdAt")
      .limit(20);

    const notifications = recentReservations.map(reservation => ({
      _id: reservation._id,
      title: reservation.status === "pending" ? "Nouvelle réservation" : 
             reservation.status === "confirmed" ? "Réservation confirmée" : 
             reservation.status === "cancelled" ? "Réservation annulée" : "Réservation",
      message: `${reservation.user?.name || reservation.user?.username} a ${reservation.status === "cancelled" ? "annulé" : "réservé"} ${reservation.resource?.name}`,
      type: "reservation",
      read: false, // Toutes les notifications sont non lues par défaut
      createdAt: reservation.createdAt,
    }));

    res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/profile
 * Mettre à jour le profil de l'admin connecté
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const { username, email } = req.body;
    const adminId = req.user._id;

    // Validation
    if (!username || !email) {
      return res.status(400).json({
        success: false,
        message: "Le nom d'utilisateur et l'email sont obligatoires.",
      });
    }

    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    const User = require("../models/User");
    const existingUser = await User.findOne({ 
      email, 
      _id: { $ne: adminId } 
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Cet email est déjà utilisé par un autre utilisateur.",
      });
    }

    // Préparer les données de mise à jour
    const updateData = { username, email };

    // Gérer l'upload de l'avatar
    if (req.file) {
      updateData.avatar = req.file.filename;
    } else if (req.body.removeAvatar === 'true') {
      updateData.avatar = null;
    }

    // Mettre à jour l'utilisateur
    const updatedUser = await User.findByIdAndUpdate(
      adminId,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur introuvable.",
      });
    }

    res.json({
      success: true,
      message: "Profil mis à jour avec succès.",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/notifications/clear
 * Effacer toutes les notifications
 */
exports.clearNotifications = async (req, res, next) => {
  try {
    // Simuler l'effacement des notifications en les marquant comme lues
    await Reservation.updateMany(
      {},
      { $set: { notified: true } }
    );

    res.json({
      success: true,
      message: "Notifications effacées avec succès.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/notifications/:id/read
 * Marquer une notification comme lue
 */
exports.markNotificationRead = async (req, res, next) => {
  try {
    // Simuler le marquage comme lu
    await Reservation.findByIdAndUpdate(
      req.params.id,
      { $set: { notified: true } }
    );

    res.json({
      success: true,
      message: "Notification marquée comme lue.",
    });
  } catch (error) {
    next(error);
  }
};
