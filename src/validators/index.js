const Joi = require('joi');

// ─── Auth Validators ───────────────────────────────────────────────────────────

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(30).alphanum().required().messages({
    'string.min': 'Le nom d\'utilisateur doit contenir au moins 3 caractères',
    'string.max': 'Le nom d\'utilisateur ne peut pas dépasser 30 caractères',
    'string.alphanum': 'Le nom d\'utilisateur ne doit contenir que des lettres et chiffres',
    'any.required': 'Le nom d\'utilisateur est requis',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'L\'adresse email est invalide',
    'any.required': 'L\'email est requis',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Le mot de passe doit contenir au moins 6 caractères',
    'any.required': 'Le mot de passe est requis',
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'L\'adresse email est invalide',
    'any.required': 'L\'email est requis',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Le mot de passe est requis',
  }),
});

// ─── Resource Validators ───────────────────────────────────────────────────────

const resourceSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'any.required': 'Le nom est requis',
  }),
  type: Joi.string()
    .valid('salle_reunion', 'terrain_sport', 'coworking', 'coiffeur')
    .required()
    .messages({
      'any.only': 'Type invalide. Valeurs acceptées : salle_reunion, terrain_sport, coworking, coiffeur',
      'any.required': 'Le type est requis',
    }),
  capacity: Joi.number().integer().min(1).optional(),
  description: Joi.string().max(500).optional().allow(''),
  pricePerHour: Joi.number().min(0).optional(),
  available: Joi.boolean().optional(),
});

// ─── Reservation Validators ───────────────────────────────────────────────────

const reservationSchema = Joi.object({
  resourceId: Joi.string().hex().length(24).required().messages({
    'any.required': 'La ressource est requise',
    'string.length': 'ID de ressource invalide',
  }),
  title: Joi.string().min(3).max(100).required().messages({
    'any.required': 'Le titre est requis',
  }),
  date: Joi.date().iso().min('now').required().messages({
    'date.min': 'La date ne peut pas être dans le passé',
    'any.required': 'La date est requise',
  }),
  startTime: Joi.string()
    .pattern(/^([0-1]\d|2[0-3]):([0-5]\d)$/)
    .required()
    .messages({
      'string.pattern.base': 'Format d\'heure invalide (attendu HH:MM)',
      'any.required': 'L\'heure de début est requise',
    }),
  endTime: Joi.string()
    .pattern(/^([0-1]\d|2[0-3]):([0-5]\d)$/)
    .required()
    .messages({
      'string.pattern.base': 'Format d\'heure invalide (attendu HH:MM)',
      'any.required': 'L\'heure de fin est requise',
    }),
  notes: Joi.string().max(500).optional().allow(''),
});

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((d) => d.message);
    return res.status(400).json({ success: false, message: 'Validation échouée', errors });
  }
  next();
};

module.exports = {
  validateRegister: validate(registerSchema),
  validateLogin: validate(loginSchema),
  validateResource: validate(resourceSchema),
  validateReservation: validate(reservationSchema),
};
