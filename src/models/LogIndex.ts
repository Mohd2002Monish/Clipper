import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILogIndexDocument extends Document {
  jobId: string;
  logPath: string;
  channel: string;
  lineCount: number;
  byteSize: number;
  lastUpdatedAt: string;
}

const LogIndexSchema = new Schema<ILogIndexDocument>(
  {
    jobId: { type: String, required: true, index: true },
    logPath: { type: String, required: true },
    channel: { type: String, required: true },
    lineCount: { type: Number, default: 0 },
    byteSize: { type: Number, default: 0 },
    lastUpdatedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    timestamps: true,
  }
);

export const LogIndex: Model<ILogIndexDocument> =
  mongoose.models.LogIndex || mongoose.model<ILogIndexDocument>('LogIndex', LogIndexSchema);
