const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'L\'utilisateur est requis'],
    },
    resource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource',
      required: [true, 'La ressource est requise'],
    },
    title: {
      type: String,
      required: [true, 'Le titre est requis'],
      trim: true,
      maxlength: [100, 'Le titre ne peut pas dépasser 100 caractères'],
    },
    date: {
      type: Date,
      required: [true, 'La date est requise'],
      min: [new Date(), 'La date ne peut pas être dans le passé'],
    },
    startTime: {
      type: String,
      required: [true, 'L\'heure de début est requise'],
      validate: {
        validator: function (v) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: "Format d'heure invalide (HH:MM)",
      },
    },
    endTime: {
      type: String,
      required: [true, 'L\'heure de fin est requise'],
      validate: {
        validator: function (v) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: "Format d'heure invalide (HH:MM)",
      },
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'rejected'],
      default: 'pending',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Les notes ne peuvent pas dépasser 500 caractères'],
    },
    attachment: {
      type: String,
      default: null,
    },
    notified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Validate that endTime > startTime
reservationSchema.pre('save', function (next) {
  if (this.startTime >= this.endTime) {
    return next(new Error('L\'heure de fin doit être après l\'heure de début'));
  }
  next();
});

// Populate user and resource by default
reservationSchema.pre(/^find/, function (next) {
  this.populate('user', 'username email avatar').populate('resource', 'name type capacity');
  next();
});

// Indexes
reservationSchema.index({ resource: 1, date: 1 });
reservationSchema.index({ user: 1, date: -1 });
reservationSchema.index({ status: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
