import mongoose, { Schema, Document, Model } from 'mongoose';
import { IJob } from '../shared/types';

export interface IJobDocument extends Omit<IJob, '_id'>, Document {}

const JobSchema = new Schema<IJobDocument>(
  {
    status: {
      type: String,
      enum: ['pending', 'queued', 'processing', 'completed', 'completed_with_errors', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    createdAt: {
      type: String,
      default: () => new Date().toISOString(),
    },
    startedAt: {
      type: String,
    },
    finishedAt: {
      type: String,
    },
    folderName: {
      type: String,
      default: 'General',
      index: true,
      trim: true,
    },
    source: {
      originalName: { type: String, required: true },
      sanitizedName: { type: String, required: true },
      storedPath: { type: String, required: true },
      sizeBytes: { type: Number, required: true },
      probe: { type: Schema.Types.Mixed },
    },
    settings: {
      outputFormat: { type: Schema.Types.Mixed, required: true },
      splitSettings: { type: Schema.Types.Mixed, required: true },
      textOverlay: { type: Schema.Types.Mixed, required: true },
      aiSubtitles: { type: Schema.Types.Mixed },
    },
    plan: [
      {
        index: { type: Number, required: true },
        start: { type: Number, required: true },
        end: { type: Number, required: true },
        duration: { type: Number, required: true },
        filename: { type: String, required: true },
        topText: { type: String },
        bottomText: { type: String },
      },
    ],
    counts: {
      total: { type: Number, default: 0 },
      rendered: { type: Number, default: 0 },
      uploaded: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    error: {
      code: { type: String },
      message: { type: String },
      details: { type: Schema.Types.Mixed },
    },
    cancelRequested: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const Job: Model<IJobDocument> =
  mongoose.models.Job || mongoose.model<IJobDocument>('Job', JobSchema);
