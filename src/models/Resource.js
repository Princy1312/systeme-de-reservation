const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Le nom de la ressource est requis"],
      trim: true,
    },
    type: {
      type: String,
      required: [true, "Le type est requis"],
      enum: [
        "salle_reunion",
        "terrain_sport", 
        "coworking",
        "coiffeur",
        "restaurant",
        "hotel",
      ],
    },
    capacity: {
      type: Number,
      min: [1, "La capacité doit être au moins 1"],
    },
    description: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      default: null,
    },
    available: {
      type: Boolean,
      default: true,
    },
    pricePerHour: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Champs de disponibilité pour l'admin
    availabilityType: {
      type: String,
      enum: ["unlimited", "limited", "stock"],
      default: "unlimited"
    },
    maxBookingsPerDay: {
      type: Number,
      min: 1,
      default: null
    },
    totalStock: {
      type: Number,
      min: 0,
      default: 0,
    },
    currentStock: {
      type: Number,
      min: 0,
      default: 0,
    },
    // Horaires de disponibilité
    availableHours: {
      monday: { open: String, close: String, closed: { type: Boolean, default: false } },
      tuesday: { open: String, close: String, closed: { type: Boolean, default: false } },
      wednesday: { open: String, close: String, closed: { type: Boolean, default: false } },
      thursday: { open: String, close: String, closed: { type: Boolean, default: false } },
      friday: { open: String, close: String, closed: { type: Boolean, default: false } },
      saturday: { open: String, close: String, closed: { type: Boolean, default: false } },
      sunday: { open: String, close: String, closed: { type: Boolean, default: false } }
    }
  },
  { timestamps: true }
);

// Indexes for search & filter
resourceSchema.index({ type: 1, available: 1 });
resourceSchema.index({ name: "text", description: "text" });

module.exports = mongoose.model("Resource", resourceSchema);
