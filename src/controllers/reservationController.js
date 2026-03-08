const Reservation = require("../models/Reservation");
const Resource = require("../models/Resource");
const paginate = require("../utils/paginate");

/**
 * Check if a time slot conflicts with existing reservations
 */
const hasConflict = async (
  resourceId,
  date,
  startTime,
  endTime,
  excludeId = null
) => {
  const filter = {
    resource: resourceId,
    date: new Date(date),
    status: { $ne: "cancelled" },
    $or: [{ startTime: { $lt: endTime }, endTime: { $gt: startTime } }],
  };

  if (excludeId) filter._id = { $ne: excludeId };

  const count = await Reservation.countDocuments(filter);
  return count > 0;
};

/**
 * GET /api/reservations
 * Admin only — all reservations with filters & pagination
 */
exports.getAll = async (req, res, next) => {
  try {
    const { status, date, resourceId, userId, sort = "-date" } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (date) filter.date = new Date(date);
    if (resourceId) filter.resource = resourceId;
    if (userId) filter.user = userId;

    const query = Reservation.find(filter).sort(sort);
    const result = await paginate(query, req.query);

    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reservations/my
 * Authenticated user's reservations
 */
exports.getMyReservations = async (req, res, next) => {
  try {
    const { status, sort = "-date" } = req.query;
    const filter = { user: req.user._id };
    if (status) filter.status = status;

    const query = Reservation.find(filter).sort(sort);
    const result = await paginate(query, req.query);

    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reservations/:id
 */
exports.getOne = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res
        .status(404)
        .json({ success: false, message: "Réservation introuvable." });
    }

    // Only owner or admin can see the reservation
    if (
      req.user.role !== "admin" &&
      reservation.user._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: "Accès refusé." });
    }

    res.json({ success: true, data: reservation });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/reservations
 */
exports.create = async (req, res, next) => {
  try {
    const { resourceId, title, date, startTime, endTime, notes } = req.body;

    // Check that resource exists and is available
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      return res
        .status(404)
        .json({ success: false, message: "Ressource introuvable." });
    }
    if (!resource.available) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Cette ressource n'est pas disponible.",
        });
    }

    // Check time conflict
    const conflict = await hasConflict(resourceId, date, startTime, endTime);
    if (conflict) {
      return res.status(409).json({
        success: false,
        message:
          "Ce créneau est déjà réservé. Veuillez choisir un autre horaire.",
      });
    }

    const data = { ...req.body, user: req.user._id, resource: resourceId };
    if (req.file) data.attachment = req.file.filename;
    delete data.resourceId;

    const reservation = await Reservation.create(data);

    res.status(201).json({ success: true, data: reservation });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/reservations/:id
 * Owner can update (unless already cancelled)
 */
exports.update = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res
        .status(404)
        .json({ success: false, message: "Réservation introuvable." });
    }

    if (
      req.user.role !== "admin" &&
      reservation.user._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: "Accès refusé." });
    }

    if (reservation.status === "cancelled") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Impossible de modifier une réservation annulée.",
        });
    }

    const { date, startTime, endTime } = req.body;

    if (date || startTime || endTime) {
      const conflict = await hasConflict(
        reservation.resource,
        date || reservation.date,
        startTime || reservation.startTime,
        endTime || reservation.endTime,
        reservation._id
      );

      if (conflict) {
        return res.status(409).json({
          success: false,
          message: "Ce créneau est déjà réservé.",
        });
      }
    }

    Object.assign(reservation, req.body);
    if (req.file) reservation.attachment = req.file.filename;
    await reservation.save();

    res.json({ success: true, data: reservation });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/reservations/:id/cancel
 */
exports.cancel = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res
        .status(404)
        .json({ success: false, message: "Réservation introuvable." });
    }

    if (
      req.user.role !== "admin" &&
      reservation.user._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: "Accès refusé." });
    }

    if (reservation.status === "cancelled") {
      return res
        .status(400)
        .json({ success: false, message: "Réservation déjà annulée." });
    }

    reservation.status = "cancelled";
    await reservation.save();

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
 * DELETE /api/reservations/:id  [admin]
 */
exports.remove = async (req, res, next) => {
  try {
    const reservation = await Reservation.findByIdAndDelete(req.params.id);
    if (!reservation) {
      return res
        .status(404)
        .json({ success: false, message: "Réservation introuvable." });
    }
    res.json({ success: true, message: "Réservation supprimée." });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/reservations/check-availability
 */
exports.checkAvailability = async (req, res, next) => {
  try {
    const { resourceId, date, startTime, endTime } = req.body;

    const resource = await Resource.findById(resourceId);
    if (!resource) {
      return res
        .status(404)
        .json({ success: false, message: "Ressource introuvable." });
    }

    const conflict = await hasConflict(resourceId, date, startTime, endTime);

    res.json({
      success: true,
      available: !conflict,
      message: conflict ? "Créneau non disponible." : "Créneau disponible.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reservations/recent
 * Pour les notifications admin - retourne les réservations depuis une date
 */
exports.getRecent = async (req, res, next) => {
  try {
    const { since } = req.query;
    const filter = {};

    if (since) {
      filter.createdAt = { $gt: new Date(since) };
    }

    const reservations = await Reservation.find(filter)
      .populate("user", "username email")
      .populate("resource", "name type")
      .sort("-createdAt")
      .limit(20);

    res.json({ success: true, data: reservations });
  } catch (error) {
    next(error);
  }
};
