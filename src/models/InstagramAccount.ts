import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInstagramAccount {
  _id?: string;
  instagramUserId: string;
  username: string;
  displayName: string;
  profilePictureUrl?: string;
  biography?: string;
  followerCount?: number;
  mediaCount?: number;
  accessToken?: string;
  tokenExpiry?: Date;
  facebookPageId?: string;
  facebookPageName?: string;
  isActive: boolean;
  isSimulated: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IInstagramAccountDocument extends Omit<IInstagramAccount, '_id'>, Document {}

const InstagramAccountSchema = new Schema<IInstagramAccountDocument>(
  {
    instagramUserId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    displayName: {
      type: String,
      default: '',
    },
    profilePictureUrl: {
      type: String,
      default: '',
    },
    biography: {
      type: String,
      default: '',
    },
    followerCount: {
      type: Number,
      default: 0,
    },
    mediaCount: {
      type: Number,
      default: 0,
    },
    accessToken: {
      type: String,
      default: '',
    },
    tokenExpiry: {
      type: Date,
    },
    facebookPageId: {
      type: String,
      default: '',
    },
    facebookPageName: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isSimulated: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const InstagramAccount: Model<IInstagramAccountDocument> =
  mongoose.models.InstagramAccount ||
  mongoose.model<IInstagramAccountDocument>('InstagramAccount', InstagramAccountSchema);
