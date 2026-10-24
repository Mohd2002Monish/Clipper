import path from 'path';
import fs from 'fs';

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '3000', 10),
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',

  // Database & Cache
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/videotimmer',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Storage & Paths
  storageDir: path.resolve(process.env.STORAGE_DIR || './storage'),
  uploadsDir: path.resolve(process.env.STORAGE_DIR || './storage', 'uploads'),
  workDir: path.resolve(process.env.STORAGE_DIR || './storage', 'work'),
  outputsDir: path.resolve(process.env.STORAGE_DIR || './storage', 'outputs'),
  logDir: path.resolve(process.env.LOG_DIR || './logs'),
  logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '7', 10),

  // Job & Worker Limits
  maxUploadSizeBytes: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '2048', 10) * 1024 * 1024,
  maxPartsLimit: parseInt(process.env.MAX_PARTS_LIMIT || '10000', 10),
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '2', 10),

  // Security
  encryptionSecret: process.env.ENCRYPTION_SECRET || 'videotimmer-dev-encryption-key-32b',
  authSecret: process.env.AUTH_SECRET || 'videotimmer-auth-secret',

  // Google Drive
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/drive/callback',
  googleDefaultFolderId: process.env.GOOGLE_DEFAULT_FOLDER_ID || '',

  // System Binaries
  ffmpegPath: resolveBinary('ffmpeg', process.env.FFMPEG_PATH),
  ffprobePath: resolveBinary('ffprobe', process.env.FFPROBE_PATH),

  // Meta Threads API & OAuth
  threadsAppId: process.env.THREADS_APP_ID || '',
  threadsAppSecret: process.env.THREADS_APP_SECRET || '',
  threadsRedirectUri: process.env.THREADS_REDIRECT_URI || 'http://localhost:3000/auth/threads/callback',

  // Meta Instagram Graph API & OAuth
  instagramAppId: process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID || '',
  instagramAppSecret: process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET || '',
  instagramRedirectUri: process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:3000/auth/instagram/callback',

  // Google Gemini AI
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || '',
};

function resolveBinary(name: string, envPath?: string): string {
  if (envPath) return envPath;
  const standardPaths = [
    `/opt/homebrew/opt/ffmpeg-full/bin/${name}`,
    `/opt/homebrew/bin/${name}`,
    `/usr/local/opt/ffmpeg-full/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`,
  ];
  for (const p of standardPaths) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return name;
}
