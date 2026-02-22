const mongoose = require('mongoose');
require('dotenv').config();

const Resource = require('./models/Resource');

const defaultResources = [
  { name: 'Salle A', type: 'salle_reunion', capacity: 10, description: 'Salle de réunion climatisée avec projecteur', pricePerHour: 50 },
  { name: 'Salle B', type: 'salle_reunion', capacity: 6, description: 'Petite salle de réunion', pricePerHour: 30 },
  { name: 'Terrain Football', type: 'terrain_sport', capacity: 22, description: 'Terrain de football extérieur avec vestiaires', pricePerHour: 80 },
  { name: 'Terrain Basketball', type: 'terrain_sport', capacity: 10, description: 'Terrain de basketball couvert', pricePerHour: 40 },
  { name: 'Bureau Individuel 1', type: 'coworking', capacity: 1, description: 'Bureau individuel calme', pricePerHour: 10 },
  { name: 'Espace Co-working', type: 'coworking', capacity: 20, description: 'Espace ouvert avec WiFi haut débit', pricePerHour: 5 },
  { name: 'Coupe Classique', type: 'coiffeur', capacity: 1, description: 'Coupe cheveux classique homme/femme', pricePerHour: 25 },
  { name: 'Coupe + Barbe', type: 'coiffeur', capacity: 1, description: 'Coupe cheveux + taille de barbe', pricePerHour: 35 },
  { name: 'Coloration', type: 'coiffeur', capacity: 1, description: 'Service coloration complète', pricePerHour: 60 },
  
];

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const count = await Resource.countDocuments();

  if (count === 0) {
    await Resource.insertMany(defaultResources);
    console.log(`✅ ${defaultResources.length} ressources insérées.`);
  } else {
    console.log(`ℹ️ ${count} ressources existent déjà, seed ignoré.`);
  }

  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error('❌ Erreur seed :', err.message);
  process.exit(1);
});
