import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFacebookAccount {
  _id?: string;
  pageId: string;
  pageName: string;
  category?: string;
  pictureUrl?: string;
  followerCount?: number;
  fanCount?: number;
  accessToken?: string;
  userAccessToken?: string;
  tokenExpiry?: Date;
  isActive: boolean;
  isSimulated: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IFacebookAccountDocument extends Omit<IFacebookAccount, '_id'>, Document {}

const FacebookAccountSchema = new Schema<IFacebookAccountDocument>(
  {
    pageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    pageName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      default: 'Entertainment & Cinema',
    },
    pictureUrl: {
      type: String,
      default: '',
    },
    followerCount: {
      type: Number,
      default: 0,
    },
    fanCount: {
      type: Number,
      default: 0,
    },
    accessToken: {
      type: String,
      default: '',
    },
    userAccessToken: {
      type: String,
      default: '',
    },
    tokenExpiry: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

export const FacebookAccount: Model<IFacebookAccountDocument> =
  mongoose.models.FacebookAccount ||
  mongoose.model<IFacebookAccountDocument>('FacebookAccount', FacebookAccountSchema);
