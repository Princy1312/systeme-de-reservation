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
  },
  { timestamps: true }
);

// Indexes for search & filter
resourceSchema.index({ type: 1, available: 1 });
resourceSchema.index({ name: "text", description: "text" });

module.exports = mongoose.model("Resource", resourceSchema);
