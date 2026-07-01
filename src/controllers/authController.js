const crypto = require('crypto');
const User = require('../models/User');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateResetToken,
  hashToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require('../utils/jwtUtils');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { sendEmail, emailTemplates } = require('../utils/emailService');
const logger = require('../utils/logger');

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, organization, badgeNumber } = req.body;

    // Admin role requires secret key
    if (role === 'admin') {
      return sendError(res, 403, 'Admin accounts cannot be created via this endpoint');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendError(res, 409, 'An account with this email already exists');
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'finder',
      phone,
      organization,
      badgeNumber,
    });

    // Send welcome email (non-blocking)
    const { subject, html } = emailTemplates.welcome(name);
    sendEmail({ to: email, subject, html }).catch((err) =>
      logger.error(`Welcome email failed: ${err.message}`)
    );

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    await User.findByIdAndUpdate(user._id, {
      $push: { refreshTokens: refreshToken },
    });

    setRefreshTokenCookie(res, refreshToken);

    return sendSuccess(res, 201, 'Account created successfully', {
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password +refreshTokens +lockUntil +loginAttempts');
    if (!user) {
      return sendError(res, 401, 'Invalid email or password');
    }

    if (user.isLocked) {
      return sendError(res, 423, 'Account temporarily locked due to too many failed attempts. Try again in 2 hours.');
    }

    if (!user.isActive) {
      return sendError(res, 401, 'Account deactivated. Please contact support.');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incLoginAttempts();
      return sendError(res, 401, 'Invalid email or password');
    }

    await user.resetLoginAttempts();

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Keep max 5 refresh tokens (multi-device support)
    const refreshTokens = [...(user.refreshTokens || []), refreshToken].slice(-5);
    await User.findByIdAndUpdate(user._id, { refreshTokens });

    setRefreshTokenCookie(res, refreshToken);

    return sendSuccess(res, 200, 'Login successful', {
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isVerified: user.isVerified,
        governmentIdVerified: user.governmentIdVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/refresh
const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return sendError(res, 401, 'No refresh token provided');
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      return sendError(res, 401, 'Invalid or expired refresh token');
    }

    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user || !user.refreshTokens?.includes(token)) {
      clearRefreshTokenCookie(res);
      return sendError(res, 401, 'Refresh token reuse detected. Please login again.');
    }

    // Rotate refresh token
    const newRefreshToken = generateRefreshToken(user._id);
    const updatedTokens = user.refreshTokens.filter((t) => t !== token);
    updatedTokens.push(newRefreshToken);

    await User.findByIdAndUpdate(user._id, { refreshTokens: updatedTokens.slice(-5) });

    const accessToken = generateAccessToken(user._id, user.role);
    setRefreshTokenCookie(res, newRefreshToken);

    return sendSuccess(res, 200, 'Token refreshed', { accessToken });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token && req.user) {
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { refreshTokens: token },
      });
    }

    clearRefreshTokenCookie(res);
    return sendSuccess(res, 200, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always respond the same to prevent email enumeration
    const genericMsg = 'If an account exists with that email, a reset link has been sent.';

    if (!user) {
      return sendSuccess(res, 200, genericMsg);
    }

    const { resetToken, hashedToken } = generateResetToken();
    await User.findByIdAndUpdate(user._id, {
      passwordResetToken: hashedToken,
      passwordResetExpires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    const resetUrl = `${process.env.CLIENT_URL}/auth/reset-password/${resetToken}`;
    const { subject, html } = emailTemplates.passwordReset(resetUrl);

    try {
      await sendEmail({ to: email, subject, html });
    } catch (err) {
      await User.findByIdAndUpdate(user._id, {
        $unset: { passwordResetToken: 1, passwordResetExpires: 1 },
      });
      return sendError(res, 500, 'Failed to send reset email. Please try again.');
    }

    return sendSuccess(res, 200, genericMsg);
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/reset-password/:token
const resetPassword = async (req, res, next) => {
  try {
    const hashedToken = hashToken(req.params.token);
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires +refreshTokens');

    if (!user) {
      return sendError(res, 400, 'Reset link is invalid or has expired');
    }

    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = []; // Invalidate all sessions
    await user.save();

    clearRefreshTokenCookie(res);
    return sendSuccess(res, 200, 'Password reset successful. Please login with your new password.');
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    return sendSuccess(res, 200, 'User profile fetched', { user });
  } catch (error) {
    next(error);
  }
};

// PUT /api/auth/change-password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return sendError(res, 400, 'Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();

    return sendSuccess(res, 200, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
  changePassword,
};
