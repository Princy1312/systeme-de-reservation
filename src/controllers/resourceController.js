const Resource = require('../models/Resource');
const Reservation = require('../models/Reservation');
const paginate = require('../utils/paginate');

/**
 * GET /api/resources
 * Query params: type, available, search, page, limit, sort
 */
exports.getAll = async (req, res, next) => {
  try {
    const { type, available, search, sort = '-createdAt' } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (available !== undefined) filter.available = available === 'true';
    if (search) filter.$text = { $search: search };

    const query = Resource.find(filter).sort(sort);
    const result = await paginate(query, req.query);

    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/resources/:id
 */
exports.getOne = async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Ressource introuvable.' });
    }
    res.json({ success: true, data: resource });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/resources  [admin]
 */
exports.create = async (req, res, next) => {
  try {
    const data = { ...req.body };
    
    // Gérer les champs de disponibilité
    if (data.availabilityType === 'limited' && !data.maxBookingsPerDay) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le nombre maximum de réservations par jour est requis pour le type limité' 
      });
    }
    
    if (data.availabilityType === 'stock' && (!data.totalStock || !data.currentStock)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le stock total et actuel sont requis pour le type stock' 
      });
    }
    
    // Valider les horaires
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const availableHours = {};
    
    days.forEach(day => {
      const open = req.body[`${day}Open`];
      const close = req.body[`${day}Close`];
      const closed = req.body[`${day}Closed`] === 'true' || req.body[`${day}Closed`] === true;
      
      if (!closed && (!open || !close)) {
        return res.status(400).json({ 
          success: false, 
          message: `Les horaires d'ouverture et de fermeture sont requis pour ${day}` 
        });
      }
      
      availableHours[day] = {
        open: closed ? null : open,
        close: closed ? null : close,
        closed
      };
    });
    
    data.availableHours = availableHours;
    
    if (req.file) data.image = req.file.filename;

    const resource = await Resource.create(data);
    res.status(201).json({ success: true, data: resource });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/resources/:id  [admin]
 */
exports.update = async (req, res, next) => {
  try {
    const data = { ...req.body };
    
    // Gérer les champs de disponibilité
    if (data.availabilityType === 'limited' && !data.maxBookingsPerDay) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le nombre maximum de réservations par jour est requis pour le type limité' 
      });
    }
    
    if (data.availabilityType === 'stock' && (!data.totalStock || !data.currentStock)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le stock total et actuel sont requis pour le type stock' 
      });
    }
    
    // Valider les horaires
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const availableHours = {};
    
    days.forEach(day => {
      const open = req.body[`${day}Open`];
      const close = req.body[`${day}Close`];
      const closed = req.body[`${day}Closed`] === 'true' || req.body[`${day}Closed`] === true;
      
      if (!closed && (!open || !close)) {
        return res.status(400).json({ 
          success: false, 
          message: `Les horaires d'ouverture et de fermeture sont requis pour ${day}` 
        });
      }
      
      availableHours[day] = {
        open: closed ? null : open,
        close: closed ? null : close,
        closed
      };
    });
    
    data.availableHours = availableHours;
    
    if (req.file) data.image = req.file.filename;

    const resource = await Resource.findByIdAndUpdate(
      req.params.id,
      data,
      { new: true, runValidators: true }
    );

    if (!resource) {
      return res.status(404).json({ success: false, message: 'Ressource introuvable.' });
    }

    res.json({ success: true, data: resource });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/resources/:id  [admin]
 */
exports.remove = async (req, res, next) => {
  try {
    const resource = await Resource.findByIdAndDelete(req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Ressource introuvable.' });
    }
    res.json({ success: true, message: 'Ressource supprimée avec succès.' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/resources/:id/availability
 * Query params: month, year
 */
exports.getAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { month, year } = req.query;
    
    // Vérifier que la ressource existe
    const resource = await Resource.findById(id);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Ressource introuvable.' });
    }
    
    // Calculer le début et la fin du mois
    const targetMonth = month ? parseInt(month) - 1 : new Date().getMonth();
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0);
    
    // Récupérer toutes les réservations pour cette ressource ce mois-ci
    const reservations = await Reservation.find({
      resource: id,
      date: {
        $gte: startDate,
        $lte: endDate
      },
      status: { $in: ['confirmed', 'pending'] }
    }).sort({ date: 1, startTime: 1 });
    
    // Générer les disponibilités pour chaque jour du mois
    const availability = {};
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    
    // Créneaux horaires standards (8h-20h)
    const timeSlots = [];
    for (let hour = 8; hour <= 20; hour++) {
      timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${targetYear}-${(targetMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const currentDate = new Date(targetYear, targetMonth, day);
      
      // Trouver les réservations pour ce jour
      const dayReservations = reservations.filter(res => {
        const resDate = new Date(res.date);
        return resDate.getDate() === day && 
               resDate.getMonth() === targetMonth && 
               resDate.getFullYear() === targetYear;
      });
      
      // Calculer les créneaux disponibles
      const unavailableSlots = new Set();
      dayReservations.forEach(reservation => {
        const startHour = parseInt(reservation.startTime.split(':')[0]);
        const endHour = parseInt(reservation.endTime.split(':')[0]);
        
        for (let hour = startHour; hour < endHour; hour++) {
          unavailableSlots.add(`${hour.toString().padStart(2, '0')}:00`);
        }
      });
      
      const availableSlots = timeSlots.filter(slot => !unavailableSlots.has(slot));
      
      // Organiser les réservations par créneau pour l'affichage
      const reservationsBySlot = {};
      dayReservations.forEach(reservation => {
        reservationsBySlot[reservation.startTime] = {
          title: reservation.title,
          user: reservation.user?.username || 'Utilisateur'
        };
      });
      
      availability[dateStr] = {
        available: availableSlots.length > 0,
        availableSlots: availableSlots.length,
        totalSlots: timeSlots.length,
        slots: availableSlots,
        reservations: reservationsBySlot,
        date: currentDate
      };
    }
    
    res.json({
      success: true,
      availability,
      reservations,
      resource: {
        id: resource._id,
        name: resource.name,
        type: resource.type,
        capacity: resource.capacity
      }
    });
  } catch (error) {
    next(error);
  }
};
