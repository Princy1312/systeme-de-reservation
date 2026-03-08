const express = require('express');
const router = express.Router();

const { protect, restrictTo } = require('../middlewares/auth');
const {
  getDashboard,
  getUsers,
  deleteUser,
  updateUserRole,
  getResources
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

module.exports = router;
