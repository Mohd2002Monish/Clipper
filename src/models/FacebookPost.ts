import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFacebookPost {
  _id?: string;
  accountId: string;
  pageId: string;
  pageName: string;
  message: string;
  title?: string;
  postType: 'REEL' | 'VIDEO' | 'PHOTO' | 'POST';
  mediaUrl?: string;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  scheduleAt?: Date;
  publishedAt?: Date;
  facebookVideoId?: string;
  facebookPostId?: string;
  facebookPermalink?: string;
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
    views: number;
    likes: number;
    comments: number;
    shares: number;
    reach: number;
    engagementRate: number;
    lastSyncedAt?: Date;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface IFacebookPostDocument extends Omit<IFacebookPost, '_id'>, Document {}

const FacebookPostSchema = new Schema<IFacebookPostDocument>(
  {
    accountId: {
      type: String,
      required: true,
      index: true,
    },
    pageId: {
      type: String,
      required: true,
      index: true,
    },
    pageName: {
      type: String,
      required: true,
      index: true,
    },
    message: {
      type: String,
      default: '',
    },
    title: {
      type: String,
      default: '',
    },
    postType: {
      type: String,
      enum: ['REEL', 'VIDEO', 'PHOTO', 'POST'],
      default: 'REEL',
      index: true,
    },
    mediaUrl: {
      type: String,
      default: '',
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
    facebookVideoId: {
      type: String,
    },
    facebookPostId: {
      type: String,
    },
    facebookPermalink: {
      type: String,
    },
    error: {
      type: String,
    },
    videoSource: {
      sourceType: {
        type: String,
        enum: ['part', 'drive', 'local', 'none'],
        default: 'none',
      },
      jobId: { type: String },
      partIndex: { type: Number },
      filename: { type: String },
    },
    firstComment: {
      enabled: { type: Boolean, default: false },
      text: { type: String, default: '' },
      status: {
        type: String,
        enum: ['pending', 'published', 'failed'],
        default: 'pending',
      },
      commentId: { type: String },
    },
    autoRepost: {
      enabled: { type: Boolean, default: false },
      delaysHours: { type: [Number], default: [168, 336] },
      lastRepostedAt: { type: Date },
    },
    analytics: {
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      reach: { type: Number, default: 0 },
      engagementRate: { type: Number, default: 0 },
      lastSyncedAt: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

FacebookPostSchema.index({ status: 1, scheduleAt: 1 });
FacebookPostSchema.index({ pageId: 1, createdAt: -1 });

export const FacebookPost: Model<IFacebookPostDocument> =
  mongoose.models.FacebookPost ||
  mongoose.model<IFacebookPostDocument>('FacebookPost', FacebookPostSchema);

