import { OutputFormatSettings, SplitSettings, TextOverlaySettings, PartPlan, AISubtitleSettings, SubtitleItem } from './schemas';

export interface VideoProbeData {
  duration: number;
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
  rotation: number;
  sampleAspectRatio: string;
  displayAspectRatio: string;
  fps: number;
  isVFR: boolean;
  videoCodec: string;
  audioCodec?: string;
  hasAudio: boolean;
  audioChannels?: number;
  bitrate?: number;
  sizeBytes: number;
  colorSpace?: string;
  isHDR: boolean;
  raw?: Record<string, unknown>;
}

export type JobStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'cancelled';

export type PartStatus =
  | 'queued'
  | 'rendering'
  | 'rendered'
  | 'uploading'
  | 'uploaded'
  | 'failed'
  | 'cancelled';

export interface IPart {
  _id?: string;
  jobId: string;
  index: number;
  start: number;
  end: number;
  duration: number;
  filename: string;
  topText?: string;
  bottomText?: string;
  status: PartStatus;
  renderProgress: number; // 0 - 100
  uploadProgress: number; // 0 - 100
  localPath?: string;
  outputSize?: number;
  outputProbe?: Partial<VideoProbeData>;
  driveFileId?: string;
  driveLink?: string;
  driveChecksum?: string;
  renderAttempts: number;
  uploadAttempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IJob {
  _id?: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  source: {
    originalName: string;
    sanitizedName: string;
    storedPath: string;
    sizeBytes: number;
    probe?: VideoProbeData;
  };
  settings: {
    outputFormat: OutputFormatSettings;
    splitSettings: SplitSettings;
    textOverlay: TextOverlaySettings;
    aiSubtitles?: AISubtitleSettings;
  };
  plan: PartPlan[];
  counts: {
    total: number;
    rendered: number;
    uploaded: number;
    failed: number;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  folderName?: string;
  cancelRequested: boolean;
}

export interface IFolder {
  _id?: string;
  name: string;
  slug: string;
  color?: string;
  description?: string;
  jobCount?: number;
  driveFolderId?: string;
  parentFolderId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IThemePreset {
  id: string;
  name: string;
  description: string;
  badge: string;
  colorPreview: {
    bg: string;
    text: string;
    border: string;
  };
  isCustom?: boolean;
  top: Partial<TextOverlaySettings['top']>;
  bottom: Partial<TextOverlaySettings['bottom']>;
  aiSubtitles?: Partial<AISubtitleSettings>;
}

export interface ISystemSetting {
  googleDrive: {
    connected: boolean;
    folderId?: string;
    folderName?: string;
    userEmail?: string;
    lastTestedAt?: string;
    authType?: 'oauth' | 'service_account';
    encryptedRefreshToken?: string;
    serviceAccountEmail?: string;
    encryptedServiceAccountJson?: string;
  };
  threads?: {
    appId?: string;
    appSecret?: string;
    redirectUri?: string;
  };
  instagram?: {
    appId?: string;
    appSecret?: string;
    redirectUri?: string;
  };
  defaults: {
    reframeMode: string;
    qualityPreset: string;
    fontFamily: string;
    filenameTemplate: string;
  };
  limits: {
    maxUploadSizeMb: number;
    maxParts: number;
    concurrency: number;
  };
}
