import mongoose, { Schema, Document, Model } from 'mongoose';
import { IThemePreset } from '../shared/types';

export interface IThemeDocument extends Omit<IThemePreset, '_id' | 'id'>, Document {}

const ThemeSchema = new Schema<IThemeDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      default: '',
    },
    badge: {
      type: String,
      default: 'Custom',
    },
    colorPreview: {
      bg: { type: String, default: '#000000' },
      text: { type: String, default: '#FFFFFF' },
      border: { type: String, default: '#2196F3' },
    },
    isCustom: {
      type: Boolean,
      default: true,
    },
    top: {
      type: Schema.Types.Mixed,
      required: true,
    },
    bottom: {
      type: Schema.Types.Mixed,
      required: true,
    },
    aiSubtitles: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

export const Theme: Model<IThemeDocument> =
  mongoose.models.Theme || mongoose.model<IThemeDocument>('Theme', ThemeSchema);
