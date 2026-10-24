import mongoose, { Schema, Document, Model } from 'mongoose';
import { IPart } from '../shared/types';

export interface IPartDocument extends Omit<IPart, '_id'>, Document {}

const PartSchema = new Schema<IPartDocument>(
  {
    jobId: { type: String, required: true, index: true },
    index: { type: Number, required: true },
    start: { type: Number, required: true },
    end: { type: Number, required: true },
    duration: { type: Number, required: true },
    filename: { type: String, required: true },
    topText: { type: String },
    bottomText: { type: String },
    status: {
      type: String,
      enum: ['queued', 'rendering', 'rendered', 'uploading', 'uploaded', 'failed', 'cancelled'],
      default: 'queued',
      index: true,
    },
    renderProgress: { type: Number, default: 0 },
    uploadProgress: { type: Number, default: 0 },
    localPath: { type: String },
    outputSize: { type: Number },
    outputProbe: { type: Schema.Types.Mixed },
    driveFileId: { type: String },
    driveLink: { type: String },
    driveChecksum: { type: String },
    renderAttempts: { type: Number, default: 0 },
    uploadAttempts: { type: Number, default: 0 },
    lastError: { type: String },
  },
  {
    timestamps: true,
  }
);

// Compound index to guarantee uniqueness of a part index within a job
PartSchema.index({ jobId: 1, index: 1 }, { unique: true });

export const Part: Model<IPartDocument> =
  mongoose.models.Part || mongoose.model<IPartDocument>('Part', PartSchema);
