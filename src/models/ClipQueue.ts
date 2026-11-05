import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IClipQueue {
  _id?: string;
  url: string;
  cleanUrl: string;
  platform: 'youtube' | 'youtube_shorts' | 'instagram_reel' | 'instagram_post' | 'tiktok' | 'twitter' | 'direct';
  status: 'pending' | 'processing' | 'downloading' | 'uploading_to_drive' | 'completed' | 'failed' | 'cancelled';
  targetFolder: {
    folderId: string;
    folderName: string;
    parentPath?: string;
  };
  contentMeta?: {
    title?: string;
    author?: string;
    description?: string;
    tags?: string[];
    durationSeconds?: number;
    thumbnailUrl?: string;
    notes?: string;
  };
  processingDirectives?: {
    autoSplit?: boolean;
    partDurationSeconds?: number;
    reframeMode?: 'blur' | 'crop' | 'fit';
    targetAspectRatio?: '9:16' | '16:9' | '1:1';
    autoCaption?: boolean;
    autoPublishCampaignId?: string;
  };
  downloadDetails?: {
    startedAt?: Date;
    completedAt?: Date;
    fileSizeBytes?: number;
    fileFormat?: string;
    resolution?: string;
    localTempPath?: string;
  };
  driveDetails?: {
    uploadedAt?: Date;
    fileId?: string;
    fileName?: string;
    fileSizeBytes?: number;
    mimeType?: string;
    webViewLink?: string;
    webContentLink?: string;
  };
  executionMeta?: {
    attempts: number;
    maxAttempts: number;
    lastError?: {
      stage: 'validation' | 'download' | 'drive_upload' | 'metadata';
      message: string;
      occurredAt: Date;
    };
    sourceClient?: {
      type: 'ios_share' | 'android_share' | 'manual_paste' | 'web_ui';
      deviceInfo?: string;
      appVersion?: string;
    };
  };
  devicePushToken?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IClipQueueDocument extends Omit<IClipQueue, '_id'>, Document {}

const ClipQueueSchema = new Schema<IClipQueueDocument>(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    cleanUrl: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['youtube', 'youtube_shorts', 'instagram_reel', 'instagram_post', 'tiktok', 'twitter', 'direct'],
      default: 'direct',
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'downloading', 'uploading_to_drive', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    targetFolder: {
      folderId: { type: String, required: true },
      folderName: { type: String, required: true, default: 'General' },
      parentPath: { type: String, default: '' },
    },
    contentMeta: {
      title: { type: String, default: '' },
      author: { type: String, default: '' },
      description: { type: String, default: '' },
      tags: { type: [String], default: [] },
      durationSeconds: { type: Number, default: 0 },
      thumbnailUrl: { type: String, default: '' },
      notes: { type: String, default: '' },
    },
    processingDirectives: {
      autoSplit: { type: Boolean, default: false },
      partDurationSeconds: { type: Number, default: 60 },
      reframeMode: { type: String, enum: ['blur', 'crop', 'fit'], default: 'blur' },
      targetAspectRatio: { type: String, enum: ['9:16', '16:9', '1:1'], default: '9:16' },
      autoCaption: { type: Boolean, default: false },
      autoPublishCampaignId: { type: String, default: '' },
    },
    downloadDetails: {
      startedAt: { type: Date },
      completedAt: { type: Date },
      fileSizeBytes: { type: Number },
      fileFormat: { type: String },
      resolution: { type: String },
      localTempPath: { type: String },
    },
    driveDetails: {
      uploadedAt: { type: Date },
      fileId: { type: String },
      fileName: { type: String },
      fileSizeBytes: { type: Number },
      mimeType: { type: String },
      webViewLink: { type: String },
      webContentLink: { type: String },
    },
    executionMeta: {
      attempts: { type: Number, default: 0 },
      maxAttempts: { type: Number, default: 3 },
      lastError: {
        stage: { type: String },
        message: { type: String },
        occurredAt: { type: Date },
      },
      sourceClient: {
        type: { type: String, default: 'manual_paste' },
        deviceInfo: { type: String },
        appVersion: { type: String },
      },
    },
    devicePushToken: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

export const ClipQueue: Model<IClipQueueDocument> =
  mongoose.models.ClipQueue || mongoose.model<IClipQueueDocument>('ClipQueue', ClipQueueSchema);
