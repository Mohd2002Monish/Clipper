import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IThreadsAccount {
  _id?: string;
  userId: string;
  username: string;
  displayName: string;
  profilePictureUrl?: string;
  biography?: string;
  followerCount?: number;
  accessToken?: string;
  tokenExpiry?: Date;
  isActive: boolean;
  isSimulated: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IThreadsAccountDocument extends Omit<IThreadsAccount, '_id'>, Document {}

const ThreadsAccountSchema = new Schema<IThreadsAccountDocument>(
  {
    userId: {
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
    accessToken: {
      type: String,
      default: '',
    },
    tokenExpiry: {
      type: Date,
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

export const ThreadsAccount: Model<IThreadsAccountDocument> =
  mongoose.models.ThreadsAccount || mongoose.model<IThreadsAccountDocument>('ThreadsAccount', ThreadsAccountSchema);
