const Claim = require('../models/Claim');
const ChildReport = require('../models/ChildReport');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendSuccess, sendError, sendPaginated } = require('../utils/apiResponse');
const { sendEmail, emailTemplates } = require('../utils/emailService');
const logger = require('../utils/logger');

// POST /api/claims/:reportId
const submitClaim = async (req, res, next) => {
  try {
    const { reportId } = req.params;

    const report = await ChildReport.findById(reportId).populate('reportedBy', 'name email');
    if (!report) return sendError(res, 404, 'Report not found');

    if (report.status === 'resolved' || report.status === 'closed') {
      return sendError(res, 400, 'This case is already closed');
    }

    // Check if user already submitted a claim
    const existingClaim = await Claim.findOne({ report: reportId, claimant: req.user._id });
    if (existingClaim) {
      return sendError(res, 409, 'You have already submitted a claim for this case');
    }

    // Prevent finder from claiming own report
    if (report.reportedBy._id.toString() === req.user._id.toString()) {
      return sendError(res, 400, 'You cannot claim a report you submitted');
    }

    const claimData = {
      ...req.body,
      report: reportId,
      claimant: req.user._id,
    };

    // Process verification documents
    if (req.files && req.files.length > 0) {
      claimData.documents = req.files.map((file, idx) => ({
        type: req.body[`docType_${idx}`] || 'other',
        url: file.path,
        publicId: file.filename,
        description: req.body[`docDesc_${idx}`] || '',
      }));
    }

    const claim = await Claim.create(claimData);

    // Update report status and add claim reference
    await ChildReport.findByIdAndUpdate(reportId, {
      $push: { claims: claim._id },
      status: 'claimed',
    });

    // Notify admin/authorities
    const admins = await User.find({ role: { $in: ['admin', 'authority'] } }).select('_id');
    const adminNotifications = admins.map((admin) => ({
      recipient: admin._id,
      type: 'claim_submitted',
      title: 'New Claim Submitted',
      message: `A claim has been submitted for case ${report.caseId} by ${req.user.name}`,
      relatedReport: reportId,
      relatedClaim: claim._id,
      priority: 'high',
    }));

    // Notify finder
    adminNotifications.push({
      recipient: report.reportedBy._id,
      type: 'claim_submitted',
      title: 'Someone claimed the child',
      message: `${req.user.name} has submitted a claim for case ${report.caseId}`,
      relatedReport: reportId,
      relatedClaim: claim._id,
      priority: 'high',
    });

    await Notification.insertMany(adminNotifications);

    // Send email to claimant
    const { subject, html } = emailTemplates.claimSubmitted(req.user.name, report.caseId);
    sendEmail({ to: req.user.email, subject, html }).catch((e) =>
      logger.error(`Claim email failed: ${e.message}`)
    );

    // Notify finder via email
    const finderEmail = emailTemplates.newClaimNotification(
      report.reportedBy.name,
      report.caseId,
      req.user.name
    );
    sendEmail({ to: report.reportedBy.email, ...finderEmail }).catch(() => {});

    await claim.populate('claimant', 'name email role');
    return sendSuccess(res, 201, 'Claim submitted successfully. Our team will review it shortly.', { claim });
  } catch (error) {
    next(error);
  }
};

// GET /api/claims (admin/authority)
const getAllClaims = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, priority } = req.query;
    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const [claims, total] = await Promise.all([
      Claim.find(query)
        .populate('report', 'caseId foundLocation.city child.gender child.estimatedAge photos')
        .populate('claimant', 'name email phone role')
        .populate('reviewedBy', 'name role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      Claim.countDocuments(query),
    ]);

    return sendPaginated(res, claims, page, limit, total);
  } catch (error) {
    next(error);
  }
};

// GET /api/claims/my-claims
const getMyClaims = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const [claims, total] = await Promise.all([
      Claim.find({ claimant: req.user._id })
        .populate('report', 'caseId foundLocation.city child.gender photos status')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      Claim.countDocuments({ claimant: req.user._id }),
    ]);

    return sendPaginated(res, claims, page, limit, total);
  } catch (error) {
    next(error);
  }
};

// GET /api/claims/:id
const getClaim = async (req, res, next) => {
  try {
    const claim = await Claim.findById(req.params.id)
      .populate('report', 'caseId foundLocation child photos status reportedBy')
      .populate('claimant', 'name email phone role')
      .populate('reviewedBy', 'name role');

    if (!claim) return sendError(res, 404, 'Claim not found');

    const isClaimant = claim.claimant._id.toString() === req.user._id.toString();
    const isPrivileged = req.user.role === 'admin' || req.user.role === 'authority';

    if (!isClaimant && !isPrivileged) {
      return sendError(res, 403, 'Not authorized to view this claim');
    }

    return sendSuccess(res, 200, 'Claim fetched', { claim });
  } catch (error) {
    next(error);
  }
};

// PUT /api/claims/:id/review (admin/authority)
const reviewClaim = async (req, res, next) => {
  try {
    const { status, reviewNotes, priority, verificationChecklist, meetingDetails } = req.body;

    const claim = await Claim.findById(req.params.id)
      .populate('claimant', 'name email')
      .populate('report', 'caseId reportedBy');

    if (!claim) return sendError(res, 404, 'Claim not found');

    const updateData = {
      status,
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      ...(reviewNotes && { reviewNotes }),
      ...(priority && { priority }),
      ...(verificationChecklist && { verificationChecklist }),
    };

    const updatedClaim = await Claim.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('claimant', 'name email')
      .populate('report', 'caseId');

    // Update report status based on claim
    let reportStatus = 'claimed';
    if (status === 'approved') reportStatus = 'under_verification';
    if (status === 'rejected') {
      // Check if there are other pending claims
      const otherClaims = await Claim.countDocuments({
        report: claim.report._id,
        status: { $in: ['pending', 'under_review', 'approved'] },
      });
      if (otherClaims === 0) reportStatus = 'open';
    }

    await ChildReport.findByIdAndUpdate(claim.report._id, { status: reportStatus });

    // Notify claimant
    await Notification.create({
      recipient: claim.claimant._id,
      type: status === 'approved' ? 'claim_approved' : 'claim_rejected',
      title: status === 'approved' ? 'Claim Approved!' : 'Claim Update',
      message:
        status === 'approved'
          ? `Your claim for case ${claim.report.caseId} has been approved. Please check your email for next steps.`
          : `Your claim for case ${claim.report.caseId} requires attention: ${reviewNotes}`,
      relatedReport: claim.report._id,
      relatedClaim: claim._id,
      priority: 'high',
    });

    // Send email
    if (status === 'approved') {
      const { subject, html } = emailTemplates.claimApproved(
        claim.claimant.name,
        meetingDetails || 'Authorities will contact you within 24 hours'
      );
      sendEmail({ to: claim.claimant.email, subject, html }).catch(() => {});
    }

    return sendSuccess(res, 200, 'Claim reviewed', { claim: updatedClaim });
  } catch (error) {
    next(error);
  }
};

// PUT /api/claims/:id/withdraw
const withdrawClaim = async (req, res, next) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return sendError(res, 404, 'Claim not found');

    if (claim.claimant.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized');
    }

    if (['approved', 'rejected', 'withdrawn'].includes(claim.status)) {
      return sendError(res, 400, `Cannot withdraw a claim with status: ${claim.status}`);
    }

    await Claim.findByIdAndUpdate(req.params.id, { status: 'withdrawn' });

    return sendSuccess(res, 200, 'Claim withdrawn successfully');
  } catch (error) {
    next(error);
  }
};

// PUT /api/claims/:id/flag (admin/authority)
const flagClaim = async (req, res, next) => {
  try {
    const { flagReason } = req.body;
    const claim = await Claim.findByIdAndUpdate(
      req.params.id,
      { flagged: true, flagReason },
      { new: true }
    );

    if (!claim) return sendError(res, 404, 'Claim not found');
    return sendSuccess(res, 200, 'Claim flagged for review', { claim });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitClaim,
  getAllClaims,
  getMyClaims,
  getClaim,
  reviewClaim,
  withdrawClaim,
  flagClaim,
};
