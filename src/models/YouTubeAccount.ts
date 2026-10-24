import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IYouTubeAccount {
  _id?: string;
  channelId: string;
  channelTitle: string;
  channelDescription?: string;
  channelCustomUrl?: string;
  channelAvatarUrl?: string;
  subscriberCount?: number;
  encryptedRefreshToken: string;
  accessToken?: string;
  tokenExpiry?: Date;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IYouTubeAccountDocument extends Omit<IYouTubeAccount, '_id'>, Document {}

const YouTubeAccountSchema = new Schema<IYouTubeAccountDocument>(
  {
    channelId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    channelTitle: {
      type: String,
      required: true,
      trim: true,
    },
    channelDescription: {
      type: String,
      default: '',
    },
    channelCustomUrl: {
      type: String,
      default: '',
    },
    channelAvatarUrl: {
      type: String,
      default: '',
    },
    subscriberCount: {
      type: Number,
      default: 0,
    },
    encryptedRefreshToken: {
      type: String,
      required: true,
    },
    accessToken: {
      type: String,
    },
    tokenExpiry: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const YouTubeAccount: Model<IYouTubeAccountDocument> =
  mongoose.models.YouTubeAccount ||
  mongoose.model<IYouTubeAccountDocument>('YouTubeAccount', YouTubeAccountSchema);
