require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ─── Inline Models (pour éviter les imports relatifs) ─────────────────────────
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role:     { type: String, enum: ['user', 'admin'], default: 'user' },
  avatar:   { type: String, default: null },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

const resourceSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  type:         { type: String, required: true, enum: ['salle_reunion', 'terrain_sport', 'coworking', 'coiffeur'] },
  capacity:     { type: Number, min: 1 },
  description:  { type: String, trim: true },
  image:        { type: String, default: null },
  available:    { type: Boolean, default: true },
  pricePerHour: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

const User     = mongoose.models.User     || mongoose.model('User',     userSchema);
const Resource = mongoose.models.Resource || mongoose.model('Resource', resourceSchema);

// ─── Default Resources ────────────────────────────────────────────────────────
const defaultResources = [
  { name: 'Salle Alpha',         type: 'salle_reunion', capacity: 10, description: 'Salle de réunion climatisée avec projecteur et tableau blanc', pricePerHour: 50 },
  { name: 'Salle Beta',          type: 'salle_reunion', capacity: 6,  description: 'Petite salle de réunion pour 6 personnes, TV 55"', pricePerHour: 30 },
  { name: 'Salle Gamma',         type: 'salle_reunion', capacity: 20, description: 'Grande salle de conférence avec système audio professionnel', pricePerHour: 80 },
  { name: 'Terrain Football',    type: 'terrain_sport', capacity: 22, description: 'Terrain de football extérieur avec vestiaires et éclairage', pricePerHour: 100 },
  { name: 'Terrain Basketball',  type: 'terrain_sport', capacity: 10, description: 'Terrain de basketball couvert, parquet professionnel', pricePerHour: 60 },
  { name: 'Terrain Tennis',      type: 'terrain_sport', capacity: 4,  description: 'Court de tennis en surface dure, filet inclus', pricePerHour: 40 },
  { name: 'Bureau Privé',        type: 'coworking',     capacity: 1,  description: 'Bureau individuel calme avec prise et lampe', pricePerHour: 15 },
  { name: 'Open Space',          type: 'coworking',     capacity: 20, description: 'Espace ouvert avec WiFi 1Gbps, café et imprimante', pricePerHour: 8 },
  { name: 'Coupe Classique',     type: 'coiffeur',      capacity: 1,  description: 'Coupe cheveux classique homme ou femme', pricePerHour: 30 },
  { name: 'Coupe + Barbe',       type: 'coiffeur',      capacity: 1,  description: 'Coupe cheveux + taille et entretien de barbe', pricePerHour: 45 },
  { name: 'Coloration Complète', type: 'coiffeur',      capacity: 1,  description: 'Service coloration professionnelle, toutes teintes', pricePerHour: 80 },
];

// ─── Seed Function ────────────────────────────────────────────────────────────
const seed = async () => {
  console.log('\n🌱 Démarrage du seed...\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connecté à MongoDB');

  // ─── Resources ──────────────────────────────────────────────────────────────
  const count = await Resource.countDocuments();
  if (count === 0) {
    await Resource.insertMany(defaultResources);
    console.log(`✅ ${defaultResources.length} ressources insérées`);
  } else {
    console.log(`ℹ️  ${count} ressources existent déjà — seed ignoré`);
  }

  // ─── Admin Account ──────────────────────────────────────────────────────────
  const adminEmail    = 'notahiana.princy@gmail.com';
  const adminPassword = 'admin@1234';
  const adminUsername = 'notahiana';

  const existing = await User.findOne({ email: adminEmail });
  if (existing) {
    // Update role to admin if not already
    if (existing.role !== 'admin') {
      await User.findByIdAndUpdate(existing._id, { role: 'admin' });
      console.log(`✅ Compte ${adminEmail} promu administrateur`);
    } else {
      console.log(`ℹ️  Compte admin ${adminEmail} existe déjà`);
    }
  } else {
    const admin = new User({
      username: adminUsername,
      email:    adminEmail,
      password: adminPassword,
      role:     'admin',
    });
    await admin.save();
    console.log(`✅ Compte admin créé : ${adminEmail}`);
  }

  // ─── User Account (email différent) ───────────────────────────────────────
  const userEmail    = 'user.notahiana@gmail.com';
  const userPassword = 'user@1234';
  const userUsername = 'notahiana_user';

  const existingUser = await User.findOne({ username: userUsername });
  if (!existingUser) {
    const user = new User({
      username: userUsername,
      email:    userEmail,
      password: userPassword,
      role:     'user',
    });
    await user.save();
    console.log(`✅ Compte utilisateur créé : ${userUsername} (${userEmail})`);
    console.log(`   📋 Identifiants: ${userUsername} / ${userPassword}`);
  } else {
    console.log(`ℹ️  Compte utilisateur ${userUsername} existe déjà`);
  }

  await mongoose.disconnect();
  console.log('\n🎉 Seed terminé !\n');
};

seed().catch((err) => {
  console.error('\n❌ Erreur seed :', err.message);
  process.exit(1);
});
