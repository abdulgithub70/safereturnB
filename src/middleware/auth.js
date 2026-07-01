const { verifyAccessToken } = require('../utils/jwtUtils');
const User = require('../models/User');
const { sendError } = require('../utils/apiResponse');
const logger = require('../utils/logger');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'Access denied. No token provided.');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.id).select('-password -refreshTokens');
    if (!user) {
      return sendError(res, 401, 'User not found. Please login again.');
    }

    if (!user.isActive) {
      return sendError(res, 401, 'Your account has been deactivated. Contact support.');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Session expired. Please login again.');
    }
    if (error.name === 'JsonWebTokenError') {
      return sendError(res, 401, 'Invalid token. Please login again.');
    }
    logger.error(`Auth middleware error: ${error.message}`);
    return sendError(res, 500, 'Authentication error');
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return sendError(
        res,
        403,
        `Access denied. Requires role: ${roles.join(' or ')}`
      );
    }
    next();
  };
};

// Optional authentication (for public routes that show less data when authenticated)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id).select('-password -refreshTokens');
      if (user && user.isActive) {
        req.user = user;
      }
    }
    next();
  } catch {
    next(); // Continue without auth
  }
};

module.exports = { authenticate, authorize, optionalAuth };
