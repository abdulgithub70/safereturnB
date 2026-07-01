const User = require('../models/User');
const ChildReport = require('../models/ChildReport');
const Claim = require('../models/Claim');
const { sendSuccess, sendError, sendPaginated } = require('../utils/apiResponse');
const { deleteFromCloudinary } = require('../config/cloudinary');

// GET /api/users/profile
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    return sendSuccess(res, 200, 'Profile fetched', { user });
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/profile
const updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'phone', 'address', 'organization'];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    return sendSuccess(res, 200, 'Profile updated', { user });
  } catch (error) {
    next(error);
  }
};

// POST /api/users/profile-photo
const uploadProfilePhoto = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No photo provided');

    const user = await User.findById(req.user._id);

    // Delete old photo
    if (user.profilePhoto?.publicId) {
      await deleteFromCloudinary(user.profilePhoto.publicId).catch(() => {});
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { profilePhoto: { url: req.file.path, publicId: req.file.filename } },
      { new: true }
    );

    return sendSuccess(res, 200, 'Profile photo updated', { user: updatedUser });
  } catch (error) {
    next(error);
  }
};

// GET /api/users/dashboard
const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;

    let dashboardData = {};

    if (role === 'finder') {
      const [reports, totalReports] = await Promise.all([
        ChildReport.find({ reportedBy: userId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('caseId status foundLocation.city child.gender createdAt photos'),
        ChildReport.countDocuments({ reportedBy: userId }),
      ]);
      dashboardData = {
        recentReports: reports,
        stats: {
          totalReports,
          openReports: await ChildReport.countDocuments({ reportedBy: userId, status: 'open' }),
          resolvedReports: await ChildReport.countDocuments({ reportedBy: userId, status: 'resolved' }),
        },
      };
    } else if (role === 'parent') {
      const [claims, totalClaims] = await Promise.all([
        Claim.find({ claimant: userId })
          .populate('report', 'caseId status photos foundLocation.city')
          .sort({ createdAt: -1 })
          .limit(5),
        Claim.countDocuments({ claimant: userId }),
      ]);
      dashboardData = {
        recentClaims: claims,
        stats: {
          totalClaims,
          pendingClaims: await Claim.countDocuments({ claimant: userId, status: 'pending' }),
          approvedClaims: await Claim.countDocuments({ claimant: userId, status: 'approved' }),
        },
      };
    } else if (role === 'admin' || role === 'authority') {
      const [
        totalReports,
        openReports,
        resolvedReports,
        pendingClaims,
        recentReports,
        recentClaims,
      ] = await Promise.all([
        ChildReport.countDocuments(),
        ChildReport.countDocuments({ status: 'open' }),
        ChildReport.countDocuments({ status: 'resolved' }),
        Claim.countDocuments({ status: { $in: ['pending', 'under_review'] } }),
        ChildReport.find().sort({ createdAt: -1 }).limit(10).select('caseId status foundLocation.city child.gender createdAt photos alertLevel'),
        Claim.find({ status: { $in: ['pending', 'under_review'] } })
          .populate('report', 'caseId')
          .populate('claimant', 'name')
          .sort({ createdAt: -1 })
          .limit(10),
      ]);
      dashboardData = {
        stats: { totalReports, openReports, resolvedReports, pendingClaims },
        recentReports,
        recentClaims,
      };
    }

    return sendSuccess(res, 200, 'Dashboard data fetched', dashboardData);
  } catch (error) {
    next(error);
  }
};

// GET /api/users (admin only)
const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    return sendPaginated(res, users, page, limit, total);
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/:id/status (admin)
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return sendError(res, 404, 'User not found');

    if (user._id.toString() === req.user._id.toString()) {
      return sendError(res, 400, 'Cannot deactivate your own account');
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: !user.isActive },
      { new: true }
    );

    return sendSuccess(
      res,
      200,
      `User ${updatedUser.isActive ? 'activated' : 'deactivated'} successfully`,
      { user: updatedUser }
    );
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/:id/verify (admin)
const verifyUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isVerified: true, governmentIdVerified: true },
      { new: true }
    );

    if (!user) return sendError(res, 404, 'User not found');
    return sendSuccess(res, 200, 'User verified', { user });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadProfilePhoto,
  getDashboard,
  getAllUsers,
  toggleUserStatus,
  verifyUser,
};
