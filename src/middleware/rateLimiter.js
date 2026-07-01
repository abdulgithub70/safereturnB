const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/apiResponse');

const createLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      sendError(res, 429, message);
    },
  });
};

// General API limiter
const generalLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  100,
  'Too many requests. Please try again later.'
);

// Auth limiter (stricter)
const authLimiter = createLimiter(
  15 * 60 * 1000,
  10,
  'Too many authentication attempts. Please try again in 15 minutes.'
);

// Report submission limiter
const reportLimiter = createLimiter(
  60 * 60 * 1000, // 1 hour
  20,
  'Too many reports submitted. Please try again later.'
);

// Claim submission limiter
const claimLimiter = createLimiter(
  60 * 60 * 1000,
  10,
  'Too many claim submissions. Please try again later.'
);

// Upload limiter
const uploadLimiter = createLimiter(
  60 * 60 * 1000,
  30,
  'Too many file uploads. Please try again later.'
);

module.exports = {
  generalLimiter,
  authLimiter,
  reportLimiter,
  claimLimiter,
  uploadLimiter,
};
