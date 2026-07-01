const express = require('express');
const router = express.Router();
const {
  createReport,
  getReports,
  getReport,
  updateReport,
  deleteReport,
  addPhotos,
  getMyReports,
  getStats,
} = require('../controllers/reportController');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { reportLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const { uploadChildPhoto } = require('../config/cloudinary');

// Public routes
router.get('/', optionalAuth, getReports);
router.get('/stats', authenticate, authorize('admin', 'authority'), getStats);
router.get('/my-reports', authenticate, getMyReports);
router.get('/:id', optionalAuth, getReport);

// Protected routes
router.post(
  '/',
  authenticate,
  reportLimiter,
  uploadChildPhoto.array('photos', 10),
  validate(schemas.childReport),
  createReport
);

router.put('/:id', authenticate, validate(schemas.childReport), updateReport);
router.delete('/:id', authenticate, deleteReport);

router.post(
  '/:id/photos',
  authenticate,
  uploadLimiter,
  uploadChildPhoto.array('photos', 5),
  addPhotos
);

module.exports = router;
