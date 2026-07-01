const ChildReport = require('../models/ChildReport');
const Claim = require('../models/Claim');
const Notification = require('../models/Notification');
const { sendSuccess, sendError, sendPaginated } = require('../utils/apiResponse');
const { deleteFromCloudinary } = require('../config/cloudinary');
const logger = require('../utils/logger');

// POST /api/reports
const createReport = async (req, res, next) => {
  try {
    const reportData = { ...req.body, reportedBy: req.user._id };

    // Process uploaded photos
    if (req.files && req.files.length > 0) {
      reportData.photos = req.files.map((file) => ({
        url: file.path,
        publicId: file.filename,
        caption: '',
      }));
    } else {
      return sendError(res, 400, 'At least one photo of the child is required');
    }

    const report = await ChildReport.create(reportData);
    await report.populate('reportedBy', 'name email phone role organization');

    return sendSuccess(res, 201, 'Report created successfully', { report });
  } catch (error) {
    next(error);
  }
};

// GET /api/reports
const getReports = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 12,
      status,
      gender,
      minAge,
      maxAge,
      city,
      country,
      search,
      alertLevel,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = { isPublic: true };

    if (status) query.status = status;
    else query.status = { $in: ['open', 'claimed', 'under_verification'] };

    if (gender && gender !== 'all') query['child.gender'] = gender;
    if (alertLevel) query.alertLevel = alertLevel;
    if (city) query['foundLocation.city'] = new RegExp(city, 'i');
    if (country) query['foundLocation.country'] = new RegExp(country, 'i');

    if (minAge || maxAge) {
      query['child.estimatedAge'] = {};
      if (minAge) query['child.estimatedAge'].$gte = parseInt(minAge);
      if (maxAge) query['child.estimatedAge'].$lte = parseInt(maxAge);
    }

    if (search) {
      query.$or = [
        { caseId: new RegExp(search, 'i') },
        { 'foundLocation.city': new RegExp(search, 'i') },
        { 'foundLocation.description': new RegExp(search, 'i') },
        { 'child.physicalDescription.distinctiveMarks': new RegExp(search, 'i') },
        { tags: new RegExp(search, 'i') },
      ];
    }

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      ChildReport.find(query)
        .populate('reportedBy', 'name role organization')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-adminNotes -claims'),
      ChildReport.countDocuments(query),
    ]);

    return sendPaginated(res, reports, page, limit, total);
  } catch (error) {
    next(error);
  }
};

// GET /api/reports/:id
const getReport = async (req, res, next) => {
  try {
    const report = await ChildReport.findById(req.params.id)
      .populate('reportedBy', 'name email phone role organization')
      .populate({
        path: 'claims',
        select: 'claimId status createdAt relationship',
        populate: { path: 'claimant', select: 'name role' },
      });

    if (!report) {
      return sendError(res, 404, 'Report not found');
    }

    // Increment view count (non-blocking)
    ChildReport.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } }).catch(() => {});

    // Hide sensitive claim details unless admin, authority, or reporter
    const isPrivileged =
      req.user &&
      (req.user.role === 'admin' ||
        req.user.role === 'authority' ||
        report.reportedBy._id.toString() === req.user._id.toString());

    const reportData = report.toObject();
    if (!isPrivileged) {
      delete reportData.adminNotes;
      // Hide full custody contact from public
      if (reportData.custodyDetails) {
        delete reportData.custodyDetails.contactPhone;
      }
    }

    return sendSuccess(res, 200, 'Report fetched', { report: reportData });
  } catch (error) {
    next(error);
  }
};

// PUT /api/reports/:id
const updateReport = async (req, res, next) => {
  try {
    const report = await ChildReport.findById(req.params.id);
    if (!report) return sendError(res, 404, 'Report not found');

    const isOwner = report.reportedBy.toString() === req.user._id.toString();
    const isPrivileged = req.user.role === 'admin' || req.user.role === 'authority';

    if (!isOwner && !isPrivileged) {
      return sendError(res, 403, 'Not authorized to update this report');
    }

    // Prevent resolving own report (admin only)
    if (req.body.status === 'resolved' && !isPrivileged) {
      return sendError(res, 403, 'Only admins or authorities can resolve cases');
    }

    const updatedReport = await ChildReport.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    ).populate('reportedBy', 'name email role');

    return sendSuccess(res, 200, 'Report updated', { report: updatedReport });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/reports/:id
const deleteReport = async (req, res, next) => {
  try {
    const report = await ChildReport.findById(req.params.id);
    if (!report) return sendError(res, 404, 'Report not found');

    const isOwner = report.reportedBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return sendError(res, 403, 'Not authorized to delete this report');
    }

    if (report.status === 'under_verification' || report.status === 'resolved') {
      return sendError(res, 400, 'Cannot delete a report under verification or already resolved');
    }

    // Delete photos from Cloudinary
    const deletePromises = report.photos.map((photo) =>
      deleteFromCloudinary(photo.publicId).catch((err) =>
        logger.warn(`Failed to delete Cloudinary file ${photo.publicId}: ${err.message}`)
      )
    );
    await Promise.allSettled(deletePromises);

    await ChildReport.findByIdAndDelete(req.params.id);
    await Claim.deleteMany({ report: req.params.id });

    return sendSuccess(res, 200, 'Report deleted successfully');
  } catch (error) {
    next(error);
  }
};

// POST /api/reports/:id/photos
const addPhotos = async (req, res, next) => {
  try {
    const report = await ChildReport.findById(req.params.id);
    if (!report) return sendError(res, 404, 'Report not found');

    const isOwner = report.reportedBy.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      return sendError(res, 403, 'Not authorized');
    }

    if (!req.files || req.files.length === 0) {
      return sendError(res, 400, 'No photos provided');
    }

    const newPhotos = req.files.map((file) => ({
      url: file.path,
      publicId: file.filename,
    }));

    const updatedReport = await ChildReport.findByIdAndUpdate(
      req.params.id,
      { $push: { photos: { $each: newPhotos } } },
      { new: true }
    );

    return sendSuccess(res, 200, 'Photos added', { report: updatedReport });
  } catch (error) {
    next(error);
  }
};

// GET /api/reports/my-reports
const getMyReports = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { reportedBy: req.user._id };
    if (status) query.status = status;

    const [reports, total] = await Promise.all([
      ChildReport.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      ChildReport.countDocuments(query),
    ]);

    return sendPaginated(res, reports, page, limit, total);
  } catch (error) {
    next(error);
  }
};

// GET /api/reports/stats (admin/authority)
const getStats = async (req, res, next) => {
  try {
    const [statusStats, recentActivity, cityStats] = await Promise.all([
      ChildReport.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      ChildReport.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('caseId status foundLocation.city child.gender createdAt'),
      ChildReport.aggregate([
        { $group: { _id: '$foundLocation.city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const stats = {
      byStatus: statusStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      recentActivity,
      topCities: cityStats,
      total: await ChildReport.countDocuments(),
      openCases: await ChildReport.countDocuments({ status: 'open' }),
      resolvedCases: await ChildReport.countDocuments({ status: 'resolved' }),
    };

    return sendSuccess(res, 200, 'Stats fetched', { stats });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReport,
  getReports,
  getReport,
  updateReport,
  deleteReport,
  addPhotos,
  getMyReports,
  getStats,
};
