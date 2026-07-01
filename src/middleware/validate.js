const Joi = require('joi');
const { sendError } = require('../utils/apiResponse');

const validate = (schema, target = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/['"]/g, ''),
      }));
      return sendError(res, 400, 'Validation failed', errors);
    }

    req[target] = value;
    next();
  };
};

// Validation schemas
const schemas = {
  register: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .required()
      .messages({
        'string.pattern.base':
          'Password must contain uppercase, lowercase, number, and special character',
      }),
    role: Joi.string().valid('finder', 'parent', 'authority').default('finder'),
    phone: Joi.string()
      .pattern(/^\+?[\d\s\-()]{7,15}$/)
      .optional(),
    organization: Joi.string().max(100).optional(),
    badgeNumber: Joi.string().max(50).optional(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  childReport: Joi.object({
    child: Joi.object({
      estimatedAge: Joi.number().min(0).max(17).required(),
      gender: Joi.string().valid('male', 'female', 'unknown').required(),
      name: Joi.string().max(100).default('Unknown'),
      physicalDescription: Joi.object({
        height: Joi.string().max(50).optional(),
        weight: Joi.string().max(50).optional(),
        eyeColor: Joi.string().max(50).optional(),
        hairColor: Joi.string().max(50).optional(),
        hairLength: Joi.string().max(50).optional(),
        skinTone: Joi.string().max(50).optional(),
        distinctiveMarks: Joi.string().max(500).optional(),
        clothingDescription: Joi.string().max(500).optional(),
      }).optional(),
      languages: Joi.array().items(Joi.string()).optional(),
      medicalNeeds: Joi.string().max(500).optional(),
    }).required(),
    foundLocation: Joi.object({
      description: Joi.string().min(10).max(500).required(),
      address: Joi.string().max(200).optional(),
      city: Joi.string().max(100).required(),
      state: Joi.string().max(100).optional(),
      country: Joi.string().max(100).required(),
      landmark: Joi.string().max(200).optional(),
      coordinates: Joi.object({
        lat: Joi.number().min(-90).max(90),
        lng: Joi.number().min(-180).max(180),
      }).optional(),
    }).required(),
    foundAt: Joi.date().max('now').required(),
    currentCustody: Joi.string()
      .valid('finder', 'police', 'hospital', 'shelter', 'ngo', 'other')
      .required(),
    custodyDetails: Joi.object({
      organization: Joi.string().max(100).optional(),
      contactPerson: Joi.string().max(100).optional(),
      contactPhone: Joi.string().max(20).optional(),
      address: Joi.string().max(200).optional(),
    }).optional(),
    alertLevel: Joi.string().valid('low', 'medium', 'high', 'critical').default('high'),
    tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
  }),

  claim: Joi.object({
    relationship: Joi.string()
      .valid('father', 'mother', 'guardian', 'grandparent', 'sibling', 'other_relative', 'other')
      .required(),
    childInfo: Joi.object({
      name: Joi.string().min(1).max(100).required(),
      dateOfBirth: Joi.date().optional(),
      birthmark: Joi.string().max(500).optional(),
      medicalHistory: Joi.string().max(1000).optional(),
      schoolName: Joi.string().max(200).optional(),
    }).required(),
    statement: Joi.string().min(50).max(2000).required(),
    preferredContact: Joi.object({
      method: Joi.string().valid('phone', 'email', 'both').default('both'),
      availableTime: Joi.string().max(200).optional(),
    }).optional(),
  }),

  updateProfile: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    phone: Joi.string()
      .pattern(/^\+?[\d\s\-()]{7,15}$/)
      .optional(),
    organization: Joi.string().max(100).optional(),
    address: Joi.object({
      street: Joi.string().max(200).optional(),
      city: Joi.string().max(100).optional(),
      state: Joi.string().max(100).optional(),
      country: Joi.string().max(100).optional(),
      zipCode: Joi.string().max(20).optional(),
    }).optional(),
  }),

  passwordChange: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .required(),
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required(),
  }),

  resetPassword: Joi.object({
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .required(),
  }),
};

module.exports = { validate, schemas };
