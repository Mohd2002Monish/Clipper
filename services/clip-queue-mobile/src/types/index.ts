export interface DriveFolder {
  id: string;
  name: string;
  parentPath?: string;
}

export interface ClipQueueItem {
  _id: string;
  url: string;
  cleanUrl: string;
  platform: 'youtube' | 'youtube_shorts' | 'instagram_reel' | 'instagram_post' | 'tiktok' | 'twitter' | 'direct';
  status: 'pending' | 'processing' | 'downloading' | 'uploading_to_drive' | 'completed' | 'failed' | 'cancelled';
  targetFolder: {
    folderId: string;
    folderName: string;
  };
  contentMeta?: {
    title?: string;
    author?: string;
    durationSeconds?: number;
  };
  driveDetails?: {
    webViewLink?: string;
    fileName?: string;
  };
  createdAt: string;
}

export interface IngestPayload {
  url: string;
  folderId: string;
  folderName: string;
  notes?: string;
  sourceClient?: string;
}

