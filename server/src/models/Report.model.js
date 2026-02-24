import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Bug Report', 'Feature Request', 'UI/UX Issue', 'Performance Issue', 'Security Concern', 'Other'],
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    reporterEmail: { type: String, default: null },
    reporterName:  { type: String, default: null },
    emailSent:     { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['open', 'in-progress', 'resolved', 'closed'],
      default: 'open',
    },
  },
  { timestamps: true }
);

export const Report = mongoose.model('Report', reportSchema);
