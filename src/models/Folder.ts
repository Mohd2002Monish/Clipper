import mongoose, { Schema, Document, Model } from 'mongoose';
import { IFolder } from '../shared/types';

export interface IFolderDocument extends Omit<IFolder, '_id'>, Document {}

const FolderSchema = new Schema<IFolderDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    color: {
      type: String,
      default: '#2196F3',
    },
    description: {
      type: String,
      default: '',
    },
    jobCount: {
      type: Number,
      default: 0,
    },
    driveFolderId: {
      type: String,
      default: null,
    },
    parentFolderId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Folder: Model<IFolderDocument> =
  mongoose.models.Folder || mongoose.model<IFolderDocument>('Folder', FolderSchema);
