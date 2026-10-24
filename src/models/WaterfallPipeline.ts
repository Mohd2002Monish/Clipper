import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWaterfallStageConfig {
  enabled: boolean;
  channelOrAccountId?: string;
  usernameOrTitle?: string;
  delayMinutes: number; // Offset from T0 in minutes (e.g. 0 for YouTube, 120 for IG, 240 for Threads)
  titleOrHookTemplate?: string;
  descriptionOrCaptionTemplate?: string;
  privacyStatus?: 'public' | 'unlisted' | 'private';
  videoType?: 'short' | 'video';
  shareToFeed?: boolean;
  ctaReplyText?: string;
}

export interface IWaterfallStageRun {
  platform: 'youtube' | 'instagram' | 'threads';
  status: 'pending' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'skipped';
  scheduledAt: Date;
  publishedAt?: Date;
  externalId?: string;
  permalink?: string;
  error?: string;
  metrics?: {
    views: number;
    likes: number;
    commentsOrReplies: number;
    lastSyncedAt?: Date;
  };
}

export interface IWaterfallRun {
  runId: string;
  videoTitle: string;
  sourceType: 'part' | 'drive' | 'local';
  sourceFilename: string;
  folderName: string;
  jobId?: string;
  partIndex?: number;
  localPath?: string;
  driveFileId?: string;
  status: 'in_progress' | 'completed' | 'partial_failure' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  stages: IWaterfallStageRun[];
}

export interface IWaterfallPipeline {
  _id?: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'archived';
  folderName?: string;
  autoSyndicateNewParts: boolean;
  stages: {
    youtube: IWaterfallStageConfig;
    instagram: IWaterfallStageConfig;
    threads: IWaterfallStageConfig;
  };
  autoReschedule: {
    enabled: boolean;
    alignToGoldenHours: boolean;
    randomJitterMinutes: number;
  };
  runs: IWaterfallRun[];
  createdAt?: string;
  updatedAt?: string;
}

export interface IWaterfallPipelineDocument extends Omit<IWaterfallPipeline, '_id'>, Document {}

const WaterfallStageConfigSchema = new Schema<IWaterfallStageConfig>(
  {
    enabled: { type: Boolean, default: true },
    channelOrAccountId: { type: String, default: '' },
    usernameOrTitle: { type: String, default: '' },
    delayMinutes: { type: Number, default: 0 },
    titleOrHookTemplate: { type: String, default: '' },
    descriptionOrCaptionTemplate: { type: String, default: '' },
    privacyStatus: { type: String, enum: ['public', 'unlisted', 'private'], default: 'public' },
    videoType: { type: String, enum: ['short', 'video'], default: 'short' },
    shareToFeed: { type: Boolean, default: true },
    ctaReplyText: { type: String, default: '' },
  },
  { _id: false }
);

const WaterfallStageRunSchema = new Schema<IWaterfallStageRun>(
  {
    platform: { type: String, enum: ['youtube', 'instagram', 'threads'], required: true },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'publishing', 'published', 'failed', 'skipped'],
      default: 'pending',
    },
    scheduledAt: { type: Date, required: true },
    publishedAt: { type: Date },
    externalId: { type: String },
    permalink: { type: String },
    error: { type: String },
    metrics: {
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      commentsOrReplies: { type: Number, default: 0 },
      lastSyncedAt: { type: Date },
    },
  },
  { _id: false }
);

const WaterfallRunSchema = new Schema<IWaterfallRun>(
  {
    runId: { type: String, required: true },
    videoTitle: { type: String, required: true },
    sourceType: { type: String, enum: ['part', 'drive', 'local'], default: 'local' },
    sourceFilename: { type: String, required: true },
    folderName: { type: String, default: 'General' },
    jobId: { type: String },
    partIndex: { type: Number },
    localPath: { type: String },
    driveFileId: { type: String },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'partial_failure', 'failed'],
      default: 'in_progress',
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    stages: [WaterfallStageRunSchema],
  },
  { _id: false }
);

const WaterfallPipelineSchema = new Schema<IWaterfallPipelineDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'archived'],
      default: 'active',
      index: true,
    },
    folderName: {
      type: String,
      default: 'General',
      index: true,
    },
    autoSyndicateNewParts: {
      type: Boolean,
      default: false,
    },
    stages: {
      youtube: { type: WaterfallStageConfigSchema, required: true },
      instagram: { type: WaterfallStageConfigSchema, required: true },
      threads: { type: WaterfallStageConfigSchema, required: true },
    },
    autoReschedule: {
      enabled: { type: Boolean, default: true },
      alignToGoldenHours: { type: Boolean, default: true },
      randomJitterMinutes: { type: Number, default: 10 },
    },
    runs: {
      type: [WaterfallRunSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const WaterfallPipeline: Model<IWaterfallPipelineDocument> =
  mongoose.models.WaterfallPipeline ||
  mongoose.model<IWaterfallPipelineDocument>('WaterfallPipeline', WaterfallPipelineSchema);
