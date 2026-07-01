const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const claimSchema = new mongoose.Schema(
  {
    claimId: {
      type: String,
      unique: true,
      default: () => `CLM-${uuidv4().split('-')[0].toUpperCase()}`,
    },

    // The report this claim is for
    report: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChildReport',
      required: true,
    },

    // The claimant (parent/guardian)
    claimant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Relationship to child
    relationship: {
      type: String,
      enum: ['father', 'mother', 'guardian', 'grandparent', 'sibling', 'other_relative', 'other'],
      required: [true, 'Relationship is required'],
    },

    // Child's actual information provided by claimant
    childInfo: {
      name: {
        type: String,
        required: [true, 'Child name is required'],
        trim: true,
      },
      dateOfBirth: Date,
      birthmark: String,
      medicalHistory: String,
      schoolName: String,
    },

    // Statement from claimant
    statement: {
      type: String,
      required: [true, 'Statement is required'],
      minlength: [50, 'Statement must be at least 50 characters'],
      maxlength: [2000, 'Statement cannot exceed 2000 characters'],
    },

    // Verification documents (Cloudinary private)
    documents: [
      {
        type: {
          type: String,
          enum: ['birth_certificate', 'government_id', 'photo_with_child', 'medical_record', 'school_record', 'other'],
        },
        url: String,
        publicId: String,
        description: String,
        verifiedAt: Date,
      },
    ],

    // Claim status
    status: {
      type: String,
      enum: ['pending', 'under_review', 'documents_requested', 'approved', 'rejected', 'withdrawn'],
      default: 'pending',
    },

    // Reviewed by admin/authority
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: Date,
    reviewNotes: String,

    // Priority (admin sets this)
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },

    // Verification checklist
    verificationChecklist: {
      identityVerified: { type: Boolean, default: false },
      relationshipConfirmed: { type: Boolean, default: false },
      documentsAuthentic: { type: Boolean, default: false },
      backgroundCheckPassed: { type: Boolean, default: false },
    },

    // Contact for coordination
    preferredContact: {
      method: {
        type: String,
        enum: ['phone', 'email', 'both'],
        default: 'both',
      },
      availableTime: String,
    },

    // Flags/alerts
    flagged: {
      type: Boolean,
      default: false,
    },
    flagReason: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
claimSchema.index({ report: 1 });
claimSchema.index({ claimant: 1 });
claimSchema.index({ status: 1 });
claimSchema.index({ createdAt: -1 });
claimSchema.index({ report: 1, claimant: 1 }, { unique: true }); // One claim per user per report

const Claim = mongoose.model('Claim', claimSchema);
module.exports = Claim;
