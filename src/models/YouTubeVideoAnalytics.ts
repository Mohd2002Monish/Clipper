import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAnalyticsHistoryPoint {
  checkedAt: Date;
  views: number;
  likes: number;
  comments: number;
}

export interface IYouTubeVideoAnalytics {
  _id?: string;
  campaignId: string;
  channelId: string;
  videoId: string;
  videoTitle: string;
  folderName: string;
  driveFileId?: string;
  uploadHour: number; // 0-23
  uploadDate: Date;
  views: number;
  likes: number;
  comments: number;
  lastCheckedAt?: Date;
  history: IAnalyticsHistoryPoint[];
  createdAt?: string;
  updatedAt?: string;
}

export interface IYouTubeVideoAnalyticsDocument extends Omit<IYouTubeVideoAnalytics, '_id'>, Document {}

const YouTubeVideoAnalyticsSchema = new Schema<IYouTubeVideoAnalyticsDocument>(
  {
    campaignId: {
      type: String,
      required: true,
      index: true,
    },
    channelId: {
      type: String,
      required: true,
      index: true,
    },
    videoId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    videoTitle: {
      type: String,
      required: true,
    },
    folderName: {
      type: String,
      required: true,
      index: true,
    },
    driveFileId: {
      type: String,
    },
    uploadHour: {
      type: Number,
      required: true,
    },
    uploadDate: {
      type: Date,
      required: true,
      index: true,
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
    history: [
      {
        checkedAt: { type: Date, required: true },
        views: { type: Number, default: 0 },
        likes: { type: Number, default: 0 },
        comments: { type: Number, default: 0 },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const YouTubeVideoAnalytics: Model<IYouTubeVideoAnalyticsDocument> =
  mongoose.models.YouTubeVideoAnalytics ||
  mongoose.model<IYouTubeVideoAnalyticsDocument>('YouTubeVideoAnalytics', YouTubeVideoAnalyticsSchema);
