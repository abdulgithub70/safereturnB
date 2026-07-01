const express = require('express');
const router = express.Router();
const {
  submitClaim,
  getAllClaims,
  getMyClaims,
  getClaim,
  reviewClaim,
  withdrawClaim,
  flagClaim,
} = require('../controllers/claimController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { claimLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const { uploadDocument } = require('../config/cloudinary');

router.get('/admin', authenticate, authorize('admin', 'authority'), getAllClaims);
router.get('/my-claims', authenticate, getMyClaims);
router.get('/:id', authenticate, getClaim);

router.post(
  '/:reportId',
  authenticate,
  claimLimiter,
  uploadDocument.array('documents', 5),
  validate(schemas.claim),
  submitClaim
);

router.put('/:id/review', authenticate, authorize('admin', 'authority'), reviewClaim);
router.put('/:id/withdraw', authenticate, withdrawClaim);
router.put('/:id/flag', authenticate, authorize('admin', 'authority'), flagClaim);

module.exports = router;
