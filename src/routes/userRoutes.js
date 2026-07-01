const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  uploadProfilePhoto,
  getDashboard,
  getAllUsers,
  toggleUserStatus,
  verifyUser,
} = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { uploadChildPhoto } = require('../config/cloudinary');

router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, validate(schemas.updateProfile), updateProfile);
router.post('/profile-photo', authenticate, uploadChildPhoto.single('photo'), uploadProfilePhoto);
router.get('/dashboard', authenticate, getDashboard);

// Admin routes
router.get('/', authenticate, authorize('admin'), getAllUsers);
router.put('/:id/status', authenticate, authorize('admin'), toggleUserStatus);
router.put('/:id/verify', authenticate, authorize('admin'), verifyUser);

module.exports = router;
