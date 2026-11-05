import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import { connectMongo } from '@/lib/db';
import { ClipQueue, IClipQueueDocument } from '@/models/ClipQueue';
import { DriveFolderRegistry } from '@/models/DriveFolderRegistry';
import { WorkerHeartbeat } from '@/models/WorkerHeartbeat';
import { driveService } from '@/lib/services/driveService';
import { Setting } from '@/models/Setting';
import { logger } from '@/lib/logger/logger';

interface DownloadResult {
  filePath: string;
  title: string;
  author: string;
  durationSeconds: number;
  fileSizeBytes: number;
  resolution: string;
}

export class ClipIngestionService {
  private tempDir: string;
  private isProcessing: boolean = false;

  constructor() {
    this.tempDir = path.resolve(process.cwd(), 'storage', 'temp_ingest');
    if (!fs.existsSync(this.tempDir)) {
      try {
        fs.mkdirSync(this.tempDir, { recursive: true });
      } catch {}
    }
  }

  /**
   * Resolves the yt-dlp binary path on Mac
   */
  private getYtDlpCommand(): { bin: string; prefixArgs: string[] } {
    // Check local node_modules
    const localNodeBinary = path.resolve(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp');
    if (fs.existsSync(localNodeBinary)) {
      return { bin: localNodeBinary, prefixArgs: [] };
    }

    // Check custom local bin
    const projectBin = path.resolve(process.cwd(), 'bin', 'yt-dlp');
    if (fs.existsSync(projectBin)) {
      return { bin: projectBin, prefixArgs: [] };
    }

    // Default to system yt-dlp
    return { bin: 'yt-dlp', prefixArgs: [] };
  }

  /**
   * Downloads video via yt-dlp to local temporary directory
   */
  public async downloadVideo(url: string): Promise<DownloadResult> {
    const timestamp = Date.now();
    const outputTemplate = path.join(this.tempDir, `clip_${timestamp}_%(id)s.%(ext)s`);
    const { bin, prefixArgs } = this.getYtDlpCommand();

    const args = [
      ...prefixArgs,
      '--format',
      'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format',
      'mp4',
      '--no-playlist',
      '--print',
      'title',
      '--print',
      'uploader',
      '--print',
      'duration',
      '--print',
      'resolution',
      '--output',
      outputTemplate,
      url,
    ];

    return new Promise((resolve, reject) => {
      let stdoutData = '';
      let stderrData = '';

      const proc = spawn(bin, args);

      proc.stdout.on('data', (d) => {
        stdoutData += d.toString();
      });

      proc.stderr.on('data', (d) => {
        stderrData += d.toString();
      });

      proc.on('error', (err) => {
        reject(
          new Error(
            `Failed to spawn yt-dlp: ${err.message}. Please verify yt-dlp is installed on your Mac ("brew install yt-dlp").`
          )
        );
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          return reject(
            new Error(`yt-dlp exited with code ${code}. Details: ${stderrData || stdoutData}`)
          );
        }

        // Parse prints
        const lines = stdoutData.trim().split('\n').filter(Boolean);
        const title = lines[0] || `Clip_${timestamp}`;
        const author = lines[1] || '';
        const durationSeconds = parseInt(lines[2], 10) || 0;
        const resolution = lines[3] || '1080p';

        // Find downloaded file matching pattern
        const files = fs.readdirSync(this.tempDir);
        const downloadedFile = files
          .filter((f) => f.startsWith(`clip_${timestamp}`))
          .map((f) => path.join(this.tempDir, f))[0];

        if (!downloadedFile || !fs.existsSync(downloadedFile)) {
          return reject(new Error('Downloaded video file could not be located on disk.'));
        }

        const stat = fs.statSync(downloadedFile);

        resolve({
          filePath: downloadedFile,
          title,
          author,
          durationSeconds,
          fileSizeBytes: stat.size,
          resolution,
        });
      });
    });
  }

  /**
   * Processes a single queued clip item:
   * 1. Marks status = processing & downloading
   * 2. Runs downloadVideo via yt-dlp
   * 3. Streams MP4 into target Google Drive folder
   * 4. Deletes temp local file
   * 5. Marks status = completed
   */
  public async processItem(item: IClipQueueDocument): Promise<void> {
    try {
      item.status = 'downloading';
      if (!item.downloadDetails) item.downloadDetails = {};
      item.downloadDetails.startedAt = new Date();
      await item.save();

      logger.system('info', 'CLIP_INGEST_START', `Downloading clip from ${item.platform}: ${item.url}`);

      // 1. Download
      const downloadResult = await this.downloadVideo(item.url);

      item.status = 'uploading_to_drive';
      item.downloadDetails.completedAt = new Date();
      item.downloadDetails.fileSizeBytes = downloadResult.fileSizeBytes;
      item.downloadDetails.resolution = downloadResult.resolution;
      item.downloadDetails.localTempPath = downloadResult.filePath;
      if (!item.contentMeta) item.contentMeta = {};
      if (!item.contentMeta.title) item.contentMeta.title = downloadResult.title;
      if (!item.contentMeta.author) item.contentMeta.author = downloadResult.author;
      item.contentMeta.durationSeconds = downloadResult.durationSeconds;
      await item.save();

      // 2. Resolve Drive Target Folder ID
      let targetFolderId = item.targetFolder?.folderId;
      const targetFolderName = item.targetFolder?.folderName || 'General';

      if (!targetFolderId || targetFolderId === 'root' || targetFolderId.startsWith('default_')) {
        // Resolve parent from Setting
        const setting = await Setting.findOne();
        const baseFolderId = setting?.googleDrive?.folderId;
        if (baseFolderId) {
          targetFolderId = await driveService.ensureSubfolder(baseFolderId, targetFolderName);
        }
      }

      // 3. Upload to Google Drive
      const cleanSafeFilename = `${downloadResult.title.replace(/[/\\?%*:|"<>]/g, '_').substring(0, 80)}.mp4`;

      logger.system(
        'info',
        'CLIP_INGEST_DRIVE_UPLOAD',
        `Uploading ${cleanSafeFilename} to Drive folder "${targetFolderName}"`
      );

      const driveRes = await driveService.uploadFile({
        filePath: downloadResult.filePath,
        filename: cleanSafeFilename,
        folderId: targetFolderId || 'root',
      });

      // 4. Cleanup local temp file
      if (fs.existsSync(downloadResult.filePath)) {
        try {
          fs.unlinkSync(downloadResult.filePath);
        } catch {}
      }

      // 5. Update Record
      item.status = 'completed';
      item.driveDetails = {
        uploadedAt: new Date(),
        fileId: driveRes.fileId,
        fileName: cleanSafeFilename,
        fileSizeBytes: downloadResult.fileSizeBytes,
        mimeType: 'video/mp4',
        webViewLink: driveRes.webViewLink,
      };
      await item.save();

      // 6. Trigger Push Notification to Mobile Device
      if (item.devicePushToken) {
        this.sendExpoPushNotification(
          item.devicePushToken,
          'Ready in Google Drive',
          `"${downloadResult.title || 'Clip'}" uploaded to Drive / ${targetFolderName} (${downloadResult.resolution})`,
          {
            driveUrl: driveRes.webViewLink,
            folderName: targetFolderName,
            clipId: String(item._id),
          }
        ).catch(() => {});
      }

      logger.system(
        'info',
        'CLIP_INGEST_SUCCESS',
        `Clip successfully downloaded and saved to Google Drive: ${cleanSafeFilename}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.system('error', 'CLIP_INGEST_FAILED', `Failed processing ${item.url}: ${msg}`);

      item.status = 'failed';
      if (!item.executionMeta) {
        item.executionMeta = { attempts: 1, maxAttempts: 3 };
      } else {
        item.executionMeta.attempts += 1;
      }
      item.executionMeta.lastError = {
        stage: 'download',
        message: msg,
        occurredAt: new Date(),
      };
      await item.save();
    }
  }

  /**
   * Processes all pending items currently in the MongoDB queue
   */
  public async processPendingQueue(): Promise<{ processed: number; errors: number }> {
    if (this.isProcessing) {
      return { processed: 0, errors: 0 };
    }

    this.isProcessing = true;
    let processed = 0;
    let errors = 0;

    try {
      await connectMongo();
      const pendingItems = await ClipQueue.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(10);
      await this.sendHeartbeat(true, pendingItems.length);

      for (const item of pendingItems) {
        try {
          await this.processItem(item);
          processed += 1;
        } catch {
          errors += 1;
        }
      }
    } finally {
      this.isProcessing = false;
      await this.sendHeartbeat(true, 0);
    }

    return { processed, errors };
  }

  /**
   * Sends a mobile push notification via Expo Push Notification service
   */
  public async sendExpoPushNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<void> {
    if (!token || (!token.startsWith('ExponentPushToken') && !token.startsWith('ExpoPushToken'))) {
      return;
    }

    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          sound: 'default',
          title,
          body,
          data,
          priority: 'high',
        }),
      });
      logger.system('info', 'EXPO_PUSH_SENT', `Push notification sent to ${token.substring(0, 20)}...`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.system('warn', 'EXPO_PUSH_FAILED', `Failed to send push notification: ${msg}`);
    }
  }

  /**
   * Pings MongoDB with current Mac worker heartbeat so mobile clients can see live status
   */
  public async sendHeartbeat(isRunning: boolean = true, activeIngests: number = 0): Promise<void> {
    try {
      await connectMongo();
      await WorkerHeartbeat.findOneAndUpdate(
        { workerName: 'Mac-Worker' },
        {
          workerName: 'Mac-Worker',
          isRunning,
          activeIngests,
          lastPingAt: new Date(),
          metadata: { hostname: os.hostname(), pid: process.pid },
        },
        { upsert: true }
      );
    } catch {
      // Non-fatal
    }
  }

  /**
   * Synchronizes current Google Drive folders to DriveFolderRegistry in MongoDB
   * so mobile devices and the Vercel API have updated folders.
   */
  public async syncFoldersToRegistry(): Promise<number> {
    await connectMongo();
    const setting = await Setting.findOne();
    const baseFolderId = setting?.googleDrive?.folderId;
    const baseFolderName = setting?.googleDrive?.folderName || 'VideoTimmer';

    const foldersList: Array<{ id: string; name: string; parentPath: string }> = [
      { id: baseFolderId || 'root', name: baseFolderName, parentPath: 'Drive' },
      { id: 'Shorts', name: 'Shorts', parentPath: `${baseFolderName} / Shorts` },
      { id: 'General', name: 'General', parentPath: `${baseFolderName} / General` },
      { id: 'GTA-5', name: 'GTA-5', parentPath: `${baseFolderName} / GTA-5` },
      { id: 'Movie-Vault', name: 'Movie-Vault', parentPath: `${baseFolderName} / Movie-Vault` },
    ];

    let registry = await DriveFolderRegistry.findOne();
    if (registry) {
      registry.folders = foldersList.map((f) => ({
        id: f.id,
        name: f.name,
        parentPath: f.parentPath,
        jobCount: 0,
        updatedAt: new Date(),
      }));
      registry.lastSyncedAt = new Date();
      await registry.save();
    } else {
      registry = await DriveFolderRegistry.create({
        folders: foldersList.map((f) => ({
          id: f.id,
          name: f.name,
          parentPath: f.parentPath,
          jobCount: 0,
          updatedAt: new Date(),
        })),
        lastSyncedAt: new Date(),
      });
    }

    return registry.folders.length;
  }
}

export const clipIngestionService = new ClipIngestionService();
