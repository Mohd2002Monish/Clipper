import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IThreadsPostItem {
  text: string;
  mediaUrl?: string;
  mediaType?: 'IMAGE' | 'VIDEO';
  isSpoilerMedia?: boolean;
  topic?: string;
  threadsMediaId?: string;
}

export interface IThreadsPost {
  _id?: string;
  accountId: string;
  username: string;
  posts: IThreadsPostItem[];
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  scheduleAt?: Date;
  publishedAt?: Date;
  threadsContainerId?: string;
  threadsPermalink?: string;
  error?: string;
  videoSource?: {
    sourceType: 'part' | 'drive' | 'local' | 'none';
    jobId?: string;
    partIndex?: number;
    filename?: string;
  };
  autoRepost?: {
    enabled: boolean;
    delaysHours: number[];
    lastRepostedAt?: Date;
  };
  followUp?: {
    enabled: boolean;
    text: string;
    delayMinutes: number;
    status: 'pending' | 'published' | 'failed';
    threadsReplyId?: string;
  };
  analytics?: {
    views: number;
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
    engagementRate: number;
    lastSyncedAt?: Date;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface IThreadsPostDocument extends Omit<IThreadsPost, '_id'>, Document {}

const ThreadsPostItemSchema = new Schema<IThreadsPostItem>(
  {
    text: { type: String, required: true },
    mediaUrl: { type: String, default: '' },
    mediaType: { type: String, enum: ['IMAGE', 'VIDEO'], default: 'VIDEO' },
    isSpoilerMedia: { type: Boolean, default: false },
    topic: { type: String, default: '' },
    threadsMediaId: { type: String, default: '' },
  },
  { _id: false }
);

const ThreadsPostSchema = new Schema<IThreadsPostDocument>(
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
    posts: {
      type: [ThreadsPostItemSchema],
      required: true,
      validate: [(val: IThreadsPostItem[]) => val.length > 0, 'At least one post is required'],
    },
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
    threadsContainerId: {
      type: String,
      default: '',
    },
    threadsPermalink: {
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
    autoRepost: {
      enabled: { type: Boolean, default: false },
      delaysHours: { type: [Number], default: [168, 336] }, // 7 days, 14 days
      lastRepostedAt: { type: Date },
    },
    followUp: {
      enabled: { type: Boolean, default: false },
      text: { type: String, default: '' },
      delayMinutes: { type: Number, default: 0 },
      status: { type: String, enum: ['pending', 'published', 'failed'], default: 'pending' },
      threadsReplyId: { type: String, default: '' },
    },
    analytics: {
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      replies: { type: Number, default: 0 },
      reposts: { type: Number, default: 0 },
      quotes: { type: Number, default: 0 },
      engagementRate: { type: Number, default: 0 },
      lastSyncedAt: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying scheduled jobs due for publication
ThreadsPostSchema.index({ status: 1, scheduleAt: 1 });

export const ThreadsPost: Model<IThreadsPostDocument> =
  mongoose.models.ThreadsPost || mongoose.model<IThreadsPostDocument>('ThreadsPost', ThreadsPostSchema);
