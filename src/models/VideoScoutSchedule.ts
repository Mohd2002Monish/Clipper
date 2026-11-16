import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVideoScoutScheduleDocument extends Document {
  name: string;
  prompt: string;
  searchKeywords: string[];
  targetFolder: string;
  dailyCount: number;
  scheduleType: 'daily' | 'interval' | 'manual';
  cronHour: number; // 0-23 (e.g. 9 for 9:00 AM)
  cronMinute: number; // 0-59
  intervalHours?: number; // e.g. 24
  isActive: boolean;

  // Pipeline directives
  autoCaption: boolean;
  captionStyle: 'viral_yellow' | 'classic_white' | 'karaoke_glow';
  reframeMode: '9:16' | '16:9' | 'blur';
  autoSplit: boolean;
  partDurationSeconds: number;

  // De-duplication memory (guaranteed 100% unique videos)
  seenVideoIds: string[];
  totalIngestedCount: number;

  // Timestamps & results
  lastRunAt?: Date;
  nextRunAt?: Date;
  lastRunResult?: {
    date: Date;
    foundCount: number;
    queuedCount: number;
    videoTitles: string[];
    status: 'success' | 'partial' | 'failed' | 'empty';
    errorMessage?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const VideoScoutScheduleSchema = new Schema<IVideoScoutScheduleDocument>(
  {
    name: { type: String, required: true, trim: true },
    prompt: { type: String, required: true, trim: true },
    searchKeywords: { type: [String], default: [] },
    targetFolder: { type: String, default: 'Shorts', trim: true },
    dailyCount: { type: Number, default: 5, min: 1, max: 25 },
    scheduleType: {
      type: String,
      enum: ['daily', 'interval', 'manual'],
      default: 'daily',
    },
    cronHour: { type: Number, default: 9, min: 0, max: 23 },
    cronMinute: { type: Number, default: 0, min: 0, max: 59 },
    intervalHours: { type: Number, default: 24, min: 1, max: 168 },
    isActive: { type: Boolean, default: true, index: true },

    autoCaption: { type: Boolean, default: true },
    captionStyle: {
      type: String,
      enum: ['viral_yellow', 'classic_white', 'karaoke_glow'],
      default: 'viral_yellow',
    },
    reframeMode: {
      type: String,
      enum: ['9:16', '16:9', 'blur'],
      default: '9:16',
    },
    autoSplit: { type: Boolean, default: true },
    partDurationSeconds: { type: Number, default: 60 },

    seenVideoIds: { type: [String], default: [], index: true },
    totalIngestedCount: { type: Number, default: 0 },

    lastRunAt: { type: Date },
    nextRunAt: { type: Date, index: true },
    lastRunResult: {
      date: { type: Date },
      foundCount: { type: Number, default: 0 },
      queuedCount: { type: Number, default: 0 },
      videoTitles: { type: [String], default: [] },
      status: {
        type: String,
        enum: ['success', 'partial', 'failed', 'empty'],
        default: 'success',
      },
      errorMessage: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Prevent recompilation in Next.js hot-reload
export const VideoScoutSchedule: Model<IVideoScoutScheduleDocument> =
  mongoose.models.VideoScoutSchedule ||
  mongoose.model<IVideoScoutScheduleDocument>('VideoScoutSchedule', VideoScoutScheduleSchema);
