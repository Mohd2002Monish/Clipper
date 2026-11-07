import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOmniPipelineTargets {
  youtube: {
    enabled: boolean;
    channelId?: string;
    channelTitle?: string;
    privacyStatus: 'public' | 'unlisted' | 'private';
    videoType: 'short' | 'long_form';
  };
  instagram: {
    enabled: boolean;
    accountId?: string;
    username?: string;
    shareToFeed: boolean;
  };
  facebook: {
    enabled: boolean;
    accountId?: string;
    pageId?: string;
    pageName?: string;
  };
  threads: {
    enabled: boolean;
    accountId?: string;
    username?: string;
    topic: string;
  };
}

export interface IOmniPipelineCaptions {
  mode?: 'unified' | 'individual';
  template: string;
  hashtags: string[];
  enableVaultCta: boolean;
  customOverrides?: {
    youtube?: string;
    instagram?: string;
    facebook?: string;
    threads?: string;
  };
}

export interface IOmniPipelineThumbnails {
  mode: 'auto_frame' | 'drive_companion' | 'custom_uploaded';
  frameTimestampSeconds: number;
  customThumbnailUrl?: string;
  individualMode?: boolean;
  channelOverrides?: {
    youtube?: {
      mode?: 'auto_frame' | 'drive_companion' | 'custom_uploaded';
      frameTimestampSeconds?: number;
      customThumbnailUrl?: string;
    };
    instagram?: {
      mode?: 'auto_frame' | 'drive_companion' | 'custom_uploaded';
      frameTimestampSeconds?: number;
      customThumbnailUrl?: string;
    };
    facebook?: {
      mode?: 'auto_frame' | 'drive_companion' | 'custom_uploaded';
      frameTimestampSeconds?: number;
      customThumbnailUrl?: string;
    };
    threads?: {
      mode?: 'auto_frame' | 'drive_companion' | 'custom_uploaded';
      frameTimestampSeconds?: number;
      customThumbnailUrl?: string;
    };
  };
}

export interface IOmniPipelineSchedule {
  mode: 'golden_slots' | 'interval' | 'manual';
  goldenSlots: number[]; // e.g. [9, 14, 21, 23, 1]
  intervalHours: number;
  dailyLimit: number;
  lastRunAt?: Date;
  nextRunSlot?: Date;
}

export interface IOmniPipeline {
  _id?: string;
  name: string;
  folderName: string;
  folderId?: string;
  targets: IOmniPipelineTargets;
  captions: IOmniPipelineCaptions;
  thumbnails: IOmniPipelineThumbnails;
  schedule: IOmniPipelineSchedule;
  stats: {
    totalVideosProcessed: number;
    totalPostsCreated: number;
    lastVideoTitle?: string;
    lastVideoId?: string;
    postedVideoIds: string[];
  };
  status: 'active' | 'paused' | 'completed';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IOmniPipelineDocument extends Omit<IOmniPipeline, '_id'>, Document {}

const OmniPipelineSchema = new Schema<IOmniPipelineDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    folderName: {
      type: String,
      required: true,
      index: true,
    },
    folderId: {
      type: String,
      default: 'root',
    },
    targets: {
      youtube: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String },
        channelTitle: { type: String },
        privacyStatus: { type: String, enum: ['public', 'unlisted', 'private'], default: 'public' },
        videoType: { type: String, enum: ['short', 'long_form'], default: 'short' },
      },
      instagram: {
        enabled: { type: Boolean, default: false },
        accountId: { type: String },
        username: { type: String },
        shareToFeed: { type: Boolean, default: true },
      },
      facebook: {
        enabled: { type: Boolean, default: false },
        accountId: { type: String },
        pageId: { type: String },
        pageName: { type: String },
      },
      threads: {
        enabled: { type: Boolean, default: false },
        accountId: { type: String },
        username: { type: String },
        topic: { type: String, default: 'Movies' },
      },
    },
    captions: {
      mode: {
        type: String,
        enum: ['unified', 'individual'],
        default: 'unified',
      },
      template: {
        type: String,
        default: '{{title}}\n\nFollow for more curated cinema moments.\n\n{{hashtags}}',
      },
      hashtags: {
        type: [String],
        default: ['#Shorts', '#Cinema', '#MovieVault', '#Bollywood', '#FilmLovers'],
      },
      enableVaultCta: {
        type: Boolean,
        default: true,
      },
      customOverrides: {
        youtube: { type: String },
        instagram: { type: String },
        facebook: { type: String },
        threads: { type: String },
      },
    },
    thumbnails: {
      mode: {
        type: String,
        enum: ['auto_frame', 'drive_companion', 'custom_uploaded'],
        default: 'auto_frame',
      },
      frameTimestampSeconds: {
        type: Number,
        default: 1.0,
      },
      customThumbnailUrl: {
        type: String,
      },
      individualMode: {
        type: Boolean,
        default: false,
      },
      channelOverrides: {
        youtube: {
          mode: { type: String },
          frameTimestampSeconds: { type: Number },
          customThumbnailUrl: { type: String },
        },
        instagram: {
          mode: { type: String },
          frameTimestampSeconds: { type: Number },
          customThumbnailUrl: { type: String },
        },
        facebook: {
          mode: { type: String },
          frameTimestampSeconds: { type: Number },
          customThumbnailUrl: { type: String },
        },
        threads: {
          mode: { type: String },
          frameTimestampSeconds: { type: Number },
          customThumbnailUrl: { type: String },
        },
      },
    },
    schedule: {
      mode: {
        type: String,
        enum: ['golden_slots', 'interval', 'manual'],
        default: 'golden_slots',
      },
      goldenSlots: {
        type: [Number],
        default: [9, 14, 21, 23, 1],
      },
      intervalHours: {
        type: Number,
        default: 4,
      },
      dailyLimit: {
        type: Number,
        default: 5,
      },
      lastRunAt: {
        type: Date,
      },
      nextRunSlot: {
        type: Date,
      },
    },
    stats: {
      totalVideosProcessed: { type: Number, default: 0 },
      totalPostsCreated: { type: Number, default: 0 },
      lastVideoTitle: { type: String },
      lastVideoId: { type: String },
      postedVideoIds: { type: [String], default: [] },
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const OmniPipeline: Model<IOmniPipelineDocument> =
  mongoose.models.OmniPipeline || mongoose.model<IOmniPipelineDocument>('OmniPipeline', OmniPipelineSchema);

