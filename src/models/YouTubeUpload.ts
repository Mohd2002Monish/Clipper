import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IYouTubeUpload {
  _id?: string;
  channelId: string;
  channelTitle: string;
  folderName: string;
  jobId?: string;
  partIndex?: number;
  partFilename?: string;
  sourceType: 'drive' | 'local';
  sourceId?: string;
  title: string;
  description: string;
  tags: string[];
  privacyStatus: 'public' | 'unlisted' | 'private';
  videoType: 'short' | 'long_form';
  isMadeForKids: boolean;
  status: 'uploading' | 'completed' | 'failed';
  videoId?: string;
  youtubeUrl?: string;
  error?: string;
  publishedAt?: Date;
  views?: number;
  likes?: number;
  comments?: number;
  lastCheckedAt?: Date;
  createdAt?: string;
  updatedAt?: string;
}

export interface IYouTubeUploadDocument extends Omit<IYouTubeUpload, '_id'>, Document {}

const YouTubeUploadSchema = new Schema<IYouTubeUploadDocument>(
  {
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
    jobId: {
      type: String,
      index: true,
    },
    partIndex: {
      type: Number,
    },
    partFilename: {
      type: String,
    },
    sourceType: {
      type: String,
      enum: ['drive', 'local'],
      default: 'local',
    },
    sourceId: {
      type: String,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    tags: [
      {
        type: String,
      },
    ],
    privacyStatus: {
      type: String,
      enum: ['public', 'unlisted', 'private'],
      default: 'private',
    },
    videoType: {
      type: String,
      enum: ['short', 'long_form'],
      default: 'short',
    },
    isMadeForKids: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['uploading', 'completed', 'failed'],
      default: 'uploading',
      index: true,
    },
    videoId: {
      type: String,
    },
    youtubeUrl: {
      type: String,
    },
    error: {
      type: String,
    },
    publishedAt: {
      type: Date,
    },
    views: {
      type: Number,
      default: 0,
    },
    likes: {
      type: Number,
      default: 0,
    },
    comments: {
      type: Number,
      default: 0,
    },
    lastCheckedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const YouTubeUpload: Model<IYouTubeUploadDocument> =
  mongoose.models.YouTubeUpload ||
  mongoose.model<IYouTubeUploadDocument>('YouTubeUpload', YouTubeUploadSchema);
