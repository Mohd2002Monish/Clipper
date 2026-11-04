import mongoose, { Schema, Document, Model } from 'mongoose';

export type VaultLeadStatus = 'new' | 'contacted' | 'access_sent' | 'archived';
export type VaultLeadPlatform = 'instagram' | 'threads' | 'facebook';

export interface IVaultLead {
  _id?: string;
  platform: VaultLeadPlatform;
  username: string;
  userDisplayName?: string;
  externalUserId?: string;
  postId?: string;
  postTitleOrHook?: string;
  commentId?: string;
  commentText: string;
  status: VaultLeadStatus;
  notes?: string;
  discoveredAt: Date;
  contactedAt?: Date;
  createdAt?: string;
  updatedAt?: string;
}

export interface IVaultLeadDocument extends Omit<IVaultLead, '_id'>, Document {}

const VaultLeadSchema = new Schema<IVaultLeadDocument>(
  {
    platform: {
      type: String,
      enum: ['instagram', 'threads', 'facebook'],
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    userDisplayName: {
      type: String,
      trim: true,
    },
    externalUserId: {
      type: String,
      trim: true,
      index: true,
    },
    postId: {
      type: String,
      trim: true,
      index: true,
    },
    postTitleOrHook: {
      type: String,
      trim: true,
    },
    commentId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    commentText: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'access_sent', 'archived'],
      default: 'new',
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
    discoveredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    contactedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

VaultLeadSchema.index({ platform: 1, username: 1 });

export const VaultLead: Model<IVaultLeadDocument> =
  mongoose.models.VaultLead || mongoose.model<IVaultLeadDocument>('VaultLead', VaultLeadSchema);

