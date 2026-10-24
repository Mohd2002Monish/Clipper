import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInstagramPost {
  _id?: string;
  accountId: string;
  username: string;
  caption: string;
  mediaType: 'REELS' | 'VIDEO' | 'IMAGE' | 'CAROUSEL' | 'STORIES';
  mediaUrl: string;
  coverUrl?: string;
  shareToFeed?: boolean;
  carouselItems?: Array<{ mediaUrl: string; mediaType: 'IMAGE' | 'VIDEO' }>;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  scheduleAt?: Date;
  publishedAt?: Date;
  instagramContainerId?: string;
  instagramMediaId?: string;
  instagramPermalink?: string;
  error?: string;
  videoSource?: {
    sourceType: 'part' | 'drive' | 'local' | 'none';
    jobId?: string;
    partIndex?: number;
    filename?: string;
  };
  firstComment?: {
    enabled: boolean;
    text: string;
    status: 'pending' | 'published' | 'failed';
    commentId?: string;
  };
  autoRepost?: {
    enabled: boolean;
    delaysHours: number[];
    lastRepostedAt?: Date;
  };
  analytics?: {
    plays: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    reach: number;
    engagementRate: number;
    lastSyncedAt?: Date;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface IInstagramPostDocument extends Omit<IInstagramPost, '_id'>, Document {}

const InstagramPostSchema = new Schema<IInstagramPostDocument>(
  {
    accountId: {
      type: String,
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      index: true,
    },
    caption: {
      type: String,
      default: '',
    },
    mediaType: {
      type: String,
      enum: ['REELS', 'VIDEO', 'IMAGE', 'CAROUSEL', 'STORIES'],
      default: 'REELS',
      index: true,
    },
    mediaUrl: {
      type: String,
      default: '',
    },
    coverUrl: {
      type: String,
      default: '',
    },
    shareToFeed: {
      type: Boolean,
      default: true,
    },
    carouselItems: [
      {
        mediaUrl: { type: String, default: '' },
        mediaType: { type: String, enum: ['IMAGE', 'VIDEO'], default: 'IMAGE' },
      },
    ],
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'publishing', 'published', 'failed'],
      default: 'draft',
      index: true,
    },
    scheduleAt: {
      type: Date,
      index: true,
    },
    publishedAt: {
      type: Date,
    },
    instagramContainerId: {
      type: String,
      default: '',
    },
    instagramMediaId: {
      type: String,
      default: '',
    },
    instagramPermalink: {
      type: String,
      default: '',
    },
    error: {
      type: String,
      default: '',
    },
    videoSource: {
      sourceType: { type: String, enum: ['part', 'drive', 'local', 'none'], default: 'none' },
      jobId: { type: String },
      partIndex: { type: Number },
      filename: { type: String },
    },
    firstComment: {
      enabled: { type: Boolean, default: false },
      text: { type: String, default: '' },
      status: { type: String, enum: ['pending', 'published', 'failed'], default: 'pending' },
      commentId: { type: String, default: '' },
    },
    autoRepost: {
      enabled: { type: Boolean, default: false },
      delaysHours: { type: [Number], default: [168, 336] }, // 7 days, 14 days
      lastRepostedAt: { type: Date },
    },
    analytics: {
      plays: { type: Number, default: 0 },
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      saves: { type: Number, default: 0 },
      reach: { type: Number, default: 0 },
      engagementRate: { type: Number, default: 0 },
      lastSyncedAt: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

InstagramPostSchema.index({ status: 1, scheduleAt: 1 });

export const InstagramPost: Model<IInstagramPostDocument> =
  mongoose.models.InstagramPost ||
  mongoose.model<IInstagramPostDocument>('InstagramPost', InstagramPostSchema);
