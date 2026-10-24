import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IYouTubeCampaign {
  _id?: string;
  name: string;
  channelId: string;
  channelTitle: string;
  folderName: string;
  status: 'active' | 'paused' | 'completed';
  dailyLimit: number; // Max 8 videos per day
  uploadedTodayCount: number;
  lastUploadDate?: string; // YYYY-MM-DD
  lastUploadAt?: Date;
  nextScheduledSlot?: string;
  scheduleHours: number[]; // e.g. [9, 11, 13, 15, 17, 19, 21, 23]
  totalUploaded: number;
  privacyStatus: 'public' | 'unlisted' | 'private';
  videoType: 'short' | 'long_form';
  lastAnalyticsSyncAt?: Date;
  lastAiOptimizationAt?: Date;
  aiScheduleRationale?: string;
  aiPerformanceSummary?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IYouTubeCampaignDocument extends Omit<IYouTubeCampaign, '_id'>, Document {}

const YouTubeCampaignSchema = new Schema<IYouTubeCampaignDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    channelId: {
      type: String,
      required: true,
      index: true,
    },
    channelTitle: {
      type: String,
      required: true,
    },
    folderName: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed'],
      default: 'active',
      index: true,
    },
    dailyLimit: {
      type: Number,
      default: 8,
    },
    uploadedTodayCount: {
      type: Number,
      default: 0,
    },
    lastUploadDate: {
      type: String,
    },
    lastUploadAt: {
      type: Date,
    },
    nextScheduledSlot: {
      type: String,
    },
    scheduleHours: {
      type: [Number],
      default: [9, 11, 13, 15, 17, 19, 21, 23], // 8 slots per day
    },
    totalUploaded: {
      type: Number,
      default: 0,
    },
    privacyStatus: {
      type: String,
      enum: ['public', 'unlisted', 'private'],
      default: 'public',
    },
    videoType: {
      type: String,
      enum: ['short', 'long_form'],
      default: 'short',
    },
    lastAnalyticsSyncAt: {
      type: Date,
    },
    lastAiOptimizationAt: {
      type: Date,
    },
    aiScheduleRationale: {
      type: String,
    },
    aiPerformanceSummary: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const YouTubeCampaign: Model<IYouTubeCampaignDocument> =
  mongoose.models.YouTubeCampaign ||
  mongoose.model<IYouTubeCampaignDocument>('YouTubeCampaign', YouTubeCampaignSchema);
