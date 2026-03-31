const express = require('express');
const router = express.Router();
const multer = require('multer');

// Configuration de multer pour l'upload d'avatar
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  }
});

const { protect, restrictTo } = require('../middlewares/auth');
const {
  getDashboard,
  getUsers,
  getUserById,
  deleteUser,
  updateUserRole,
  getResources,
  getResourceById,
  createResource,
  updateResource,
  deleteResource,
  getReservations,
  confirmReservation,
  cancelReservation,
  deleteReservation,
  getNotifications,
  clearNotifications,
  updateProfile,
  markNotificationRead
} = require('../controllers/adminController');

// Toutes les routes admin nécessitent une authentification et le rôle admin
router.use(protect);
router.use(restrictTo('admin'));

/**
 * @route   GET /api/admin/dashboard
 * @desc    Obtenir les statistiques du dashboard
 * @access  Admin
 */
router.get('/dashboard', getDashboard);

/**
 * @route   GET /api/admin/users
 * @desc    Liste des utilisateurs
 * @access  Admin
 */
router.get('/users', getUsers);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Obtenir un utilisateur spécifique
 * @access  Admin
 */
router.get('/users/:id', getUserById);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Supprimer un utilisateur
 * @access  Admin
 */
router.delete('/users/:id', deleteUser);

/**
 * @route   PUT /api/admin/users/:id/role
 * @desc    Modifier le rôle d'un utilisateur
 * @access  Admin
 */
router.put('/users/:id/role', updateUserRole);

/**
 * @route   GET /api/admin/resources
 * @desc    Liste des ressources pour l'admin
 * @access  Admin
 */
router.get('/resources', getResources);

/**
 * @route   GET /api/admin/resources/:id
 * @desc    Obtenir une ressource spécifique
 * @access  Admin
 */
router.get('/resources/:id', getResourceById);

/**
 * @route   POST /api/admin/resources
 * @desc    Créer une nouvelle ressource
 * @access  Admin
 */
router.post('/resources', createResource);

/**
 * @route   PUT /api/admin/resources/:id
 * @desc    Mettre à jour une ressource
 * @access  Admin
 */
router.put('/resources/:id', updateResource);

/**
 * @route   DELETE /api/admin/resources/:id
 * @desc    Supprimer une ressource
 * @access  Admin
 */
router.delete('/resources/:id', deleteResource);

/**
 * @route   GET /api/admin/reservations
 * @desc    Liste des réservations pour l'admin
 * @access  Admin
 */
router.get('/reservations', getReservations);

/**
 * @route   PUT /api/admin/reservations/:id/confirm
 * @desc    Confirmer une réservation
 * @access  Admin
 */
router.put('/reservations/:id/confirm', confirmReservation);

/**
 * @route   PUT /api/admin/reservations/:id/cancel
 * @desc    Annuler une réservation
 * @access  Admin
 */
router.put('/reservations/:id/cancel', cancelReservation);

/**
 * @route   DELETE /api/admin/reservations/:id
 * @desc    Supprimer une réservation
 * @access  Admin
 */
router.delete('/reservations/:id', deleteReservation);

/**
 * @route   GET /api/admin/notifications
 * @desc    Obtenir les notifications admin
 * @access  Admin
 */
router.get('/notifications', getNotifications);

/**
 * @route   PUT /api/admin/notifications/clear
 * @desc    Effacer toutes les notifications
 * @access  Admin
 */
router.put('/notifications/clear', clearNotifications);

/**
 * @route   PUT /api/admin/profile
 * @desc    Mettre à jour le profil de l'admin
 * @access  Admin
 */
router.put('/profile', upload.single('avatar'), updateProfile);

/**
 * @route   PUT /api/admin/notifications/:id/read
 * @desc    Marquer une notification comme lue
 * @access  Admin
 */
router.put('/notifications/:id/read', markNotificationRead);

module.exports = router;
