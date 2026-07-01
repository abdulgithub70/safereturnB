const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const childReportSchema = new mongoose.Schema(
  {
    caseId: {
      type: String,
      unique: true,
      default: () => `CASE-${uuidv4().split('-')[0].toUpperCase()}`,
    },
    // Child Information
    child: {
      estimatedAge: {
        type: Number,
        required: [true, 'Estimated age is required'],
        min: [0, 'Age cannot be negative'],
        max: [17, 'This platform handles minors only'],
      },
      gender: {
        type: String,
        enum: ['male', 'female', 'unknown'],
        required: [true, 'Gender is required'],
      },
      physicalDescription: {
        height: String, // e.g., "3 feet 2 inches"
        weight: String,
        eyeColor: String,
        hairColor: String,
        hairLength: String,
        skinTone: String,
        distinctiveMarks: String, // birthmarks, scars, tattoos
        clothingDescription: String,
      },
      languages: [String], // Languages the child speaks
      name: {
        type: String,
        default: 'Unknown',
      },
      medicalNeeds: {
        type: String,
        trim: true,
      },
    },

    // Photos
    photos: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        caption: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    // Location where child was found
    foundLocation: {
      description: {
        type: String,
        required: [true, 'Location description is required'],
        trim: true,
      },
      address: String,
      city: {
        type: String,
        required: [true, 'City is required'],
        trim: true,
      },
      state: String,
      country: {
        type: String,
        required: [true, 'Country is required'],
        trim: true,
      },
      coordinates: {
        lat: Number,
        lng: Number,
      },
      landmark: String,
    },

    // Date/time child was found
    foundAt: {
      type: Date,
      required: [true, 'Date/time found is required'],
      default: Date.now,
    },

    // Reporter/finder
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Current custody
    currentCustody: {
      type: String,
      enum: ['finder', 'police', 'hospital', 'shelter', 'ngo', 'other'],
      required: [true, 'Current custody status is required'],
    },
    custodyDetails: {
      organization: String,
      contactPerson: String,
      contactPhone: String,
      address: String,
    },

    // Status
    status: {
      type: String,
      enum: ['open', 'claimed', 'under_verification', 'resolved', 'transferred', 'closed'],
      default: 'open',
    },

    // Claims by potential parents
    claims: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Claim',
      },
    ],

    // Admin notes (internal)
    adminNotes: {
      type: String,
      select: false,
    },

    // Visibility
    isPublic: {
      type: Boolean,
      default: true,
    },

    // Alert level
    alertLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'high',
    },

    // Resolution details
    resolution: {
      resolvedAt: Date,
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reunificationMethod: String,
      notes: String,
    },

    // Views/engagement tracking
    viewCount: {
      type: Number,
      default: 0,
    },

    // Tags for search
    tags: [String],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient querying (caseId index already created by unique:true above)
childReportSchema.index({ status: 1 });
childReportSchema.index({ 'foundLocation.city': 1, 'foundLocation.country': 1 });
childReportSchema.index({ 'child.gender': 1 });
childReportSchema.index({ 'child.estimatedAge': 1 });
childReportSchema.index({ createdAt: -1 });
childReportSchema.index({ reportedBy: 1 });
childReportSchema.index({
  'child.physicalDescription.eyeColor': 1,
  'child.physicalDescription.hairColor': 1,
});

// Text search index
childReportSchema.index({
  'child.physicalDescription.distinctiveMarks': 'text',
  'foundLocation.description': 'text',
  'foundLocation.city': 'text',
  caseId: 'text',
  tags: 'text',
});

// Virtual: days since found
childReportSchema.virtual('daysSinceFound').get(function () {
  return Math.floor((Date.now() - this.foundAt) / (1000 * 60 * 60 * 24));
});

// Virtual: primary photo
childReportSchema.virtual('primaryPhoto').get(function () {
  return this.photos && this.photos.length > 0 ? this.photos[0].url : null;
});

const ChildReport = mongoose.model('ChildReport', childReportSchema);
module.exports = ChildReport;
