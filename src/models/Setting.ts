import mongoose, { Schema, Document, Model } from 'mongoose';
import { ISystemSetting } from '../shared/types';

export interface ISettingDocument extends ISystemSetting, Document {}

const SettingSchema = new Schema<ISettingDocument>(
  {
    googleDrive: {
      connected: { type: Boolean, default: false },
      folderId: { type: String },
      folderName: { type: String },
      userEmail: { type: String },
      lastTestedAt: { type: String },
      authType: { type: String, enum: ['oauth', 'service_account'], default: 'oauth' },
      encryptedRefreshToken: { type: String },
      serviceAccountEmail: { type: String },
      encryptedServiceAccountJson: { type: String },
    },
    threads: {
      appId: { type: String, default: '' },
      appSecret: { type: String, default: '' },
      redirectUri: { type: String, default: 'http://localhost:3000/auth/threads/callback' },
    },
    instagram: {
      appId: { type: String, default: '' },
      appSecret: { type: String, default: '' },
      redirectUri: { type: String, default: 'http://localhost:3000/auth/instagram/callback' },
    },
    defaults: {
      reframeMode: { type: String, default: 'blur' },
      qualityPreset: { type: String, default: 'balanced' },
      fontFamily: { type: String, default: 'Noto Sans' },
      filenameTemplate: { type: String, default: '{title}_part{nn}' },
    },
    limits: {
      maxUploadSizeMb: { type: Number, default: 2048 },
      maxParts: { type: Number, default: 10000 },
      concurrency: { type: Number, default: 2 },
    },
  },
  {
    timestamps: true,
  }
);

export const Setting: Model<ISettingDocument> =
  mongoose.models.Setting || mongoose.model<ISettingDocument>('Setting', SettingSchema);
