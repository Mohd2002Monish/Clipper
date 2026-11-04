import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDriveFolderItem {
  id: string;
  name: string;
  parentPath?: string;
  jobCount?: number;
  updatedAt?: Date;
}

export interface IDriveFolderRegistryDocument extends Document {
  folders: IDriveFolderItem[];
  lastSyncedAt: Date;
}

const DriveFolderRegistrySchema = new Schema<IDriveFolderRegistryDocument>(
  {
    folders: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        parentPath: { type: String, default: '' },
        jobCount: { type: Number, default: 0 },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const DriveFolderRegistry: Model<IDriveFolderRegistryDocument> =
  mongoose.models.DriveFolderRegistry ||
  mongoose.model<IDriveFolderRegistryDocument>('DriveFolderRegistry', DriveFolderRegistrySchema);

