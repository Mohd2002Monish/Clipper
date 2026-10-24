import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from '../logger/logger';

export class CleanupService {
  /**
   * Cleans up working directories in storage/work/ older than maxAgeMs (default 24h)
   */
  public async cleanupWorkDirectories(maxAgeHours: number = 24): Promise<number> {
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    const now = Date.now();
    let cleanedCount = 0;

    if (!fs.existsSync(config.workDir)) return 0;

    try {
      const entries = fs.readdirSync(config.workDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const itemPath = path.join(config.workDir, entry.name);
          const stat = fs.statSync(itemPath);
          if (now - stat.mtimeMs > maxAgeMs) {
            fs.rmSync(itemPath, { recursive: true, force: true });
            cleanedCount++;
            logger.cleanup('info', 'WORK_DIR_CLEANED', `Removed expired work directory: ${entry.name}`);
          }
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.cleanup('error', 'CLEANUP_WORK_ERROR', errorMsg);
    }

    return cleanedCount;
  }

  /**
   * Cleans up expired upload chunk sessions in storage/uploads/.sessions/ older than maxAgeHours (default 12h)
   */
  public async cleanupUploadSessions(maxAgeHours: number = 12): Promise<number> {
    const sessionsDir = path.join(config.uploadsDir, '.sessions');
    if (!fs.existsSync(sessionsDir)) return 0;

    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    const now = Date.now();
    let cleanedCount = 0;

    try {
      const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const itemPath = path.join(sessionsDir, entry.name);
          const stat = fs.statSync(itemPath);
          if (now - stat.mtimeMs > maxAgeMs) {
            fs.rmSync(itemPath, { recursive: true, force: true });
            cleanedCount++;
            logger.cleanup('info', 'SESSION_CLEANED', `Removed expired upload session: ${entry.name}`);
          }
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.cleanup('error', 'CLEANUP_SESSIONS_ERROR', errorMsg);
    }

    return cleanedCount;
  }

  /**
   * Cleans up expired log files older than config.logRetentionDays
   */
  public async cleanupOldLogs(retentionDays: number = config.logRetentionDays): Promise<number> {
    if (!fs.existsSync(config.logDir)) return 0;

    const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let cleanedCount = 0;

    try {
      // 1. Clean per-job logs in logs/jobs/
      const jobsLogDir = path.join(config.logDir, 'jobs');
      if (fs.existsSync(jobsLogDir)) {
        const files = fs.readdirSync(jobsLogDir);
        for (const file of files) {
          const filePath = path.join(jobsLogDir, file);
          const stat = fs.statSync(filePath);
          if (now - stat.mtimeMs > maxAgeMs) {
            fs.unlinkSync(filePath);
            cleanedCount++;
          }
        }
      }

      // 2. Clean per-part ffmpeg stderr logs in logs/ffmpeg/
      const ffmpegLogDir = path.join(config.logDir, 'ffmpeg');
      if (fs.existsSync(ffmpegLogDir)) {
        const dirs = fs.readdirSync(ffmpegLogDir);
        for (const dir of dirs) {
          const dirPath = path.join(ffmpegLogDir, dir);
          const stat = fs.statSync(dirPath);
          if (now - stat.mtimeMs > maxAgeMs) {
            fs.rmSync(dirPath, { recursive: true, force: true });
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        logger.cleanup('info', 'LOGS_PRUNED', `Pruned ${cleanedCount} expired job/ffmpeg log files.`);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.cleanup('error', 'CLEANUP_LOGS_ERROR', errorMsg);
    }

    return cleanedCount;
  }

  /**
   * Helper to recursively calculate directory size in bytes
   */
  public getDirectorySize(dirPath: string): number {
    if (!fs.existsSync(dirPath)) return 0;
    let total = 0;
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        try {
          if (item.isDirectory()) {
            total += this.getDirectorySize(fullPath);
          } else if (item.isFile()) {
            total += fs.statSync(fullPath).size;
          }
        } catch {
          // Ignore transient locks
        }
      }
    } catch {
      // Ignore
    }
    return total;
  }

  /**
   * Get detailed breakdown of storage consumption
   */
  public getStorageBreakdown(): {
    sessionsBytes: number;
    uploadsBytes: number;
    workBytes: number;
    outputsBytes: number;
    totalBytes: number;
  } {
    const sessionsDir = path.join(config.uploadsDir, '.sessions');
    const sessionsBytes = this.getDirectorySize(sessionsDir);
    const workBytes = this.getDirectorySize(config.workDir);
    const outputsBytes = this.getDirectorySize(config.outputsDir);

    // Uploads excluding .sessions
    let uploadsBytes = 0;
    if (fs.existsSync(config.uploadsDir)) {
      const files = fs.readdirSync(config.uploadsDir, { withFileTypes: true });
      for (const f of files) {
        if (f.isFile() && f.name !== '.gitkeep') {
          try {
            uploadsBytes += fs.statSync(path.join(config.uploadsDir, f.name)).size;
          } catch {}
        }
      }
    }

    return {
      sessionsBytes,
      uploadsBytes,
      workBytes,
      outputsBytes,
      totalBytes: sessionsBytes + uploadsBytes + workBytes + outputsBytes,
    };
  }

  /**
   * Purge storage directories and return exact bytes freed
   */
  public async cleanStorage(options: {
    cleanSessions?: boolean;
    cleanWork?: boolean;
    cleanUploads?: boolean;
    cleanOutputs?: boolean;
  } = {}): Promise<{
    freedBytes: number;
    freedFormatted: string;
    sessionsRemoved: number;
    workRemoved: number;
    uploadsRemoved: number;
    outputsRemoved: number;
  }> {
    const {
      cleanSessions = true,
      cleanWork = true,
      cleanUploads = true,
      cleanOutputs = false,
    } = options;

    const initialBreakdown = this.getStorageBreakdown();
    let sessionsRemoved = 0;
    let workRemoved = 0;
    let uploadsRemoved = 0;
    let outputsRemoved = 0;

    // 1. Clean upload chunk sessions
    if (cleanSessions) {
      const sessionsDir = path.join(config.uploadsDir, '.sessions');
      if (fs.existsSync(sessionsDir)) {
        const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
        for (const entry of entries) {
          try {
            fs.rmSync(path.join(sessionsDir, entry.name), { recursive: true, force: true });
            sessionsRemoved++;
          } catch {}
        }
      }
    }

    // 2. Clean temporary work directories
    if (cleanWork && fs.existsSync(config.workDir)) {
      const entries = fs.readdirSync(config.workDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name !== '.gitkeep') {
          try {
            fs.rmSync(path.join(config.workDir, entry.name), { recursive: true, force: true });
            workRemoved++;
          } catch {}
        }
      }
    }

    // 3. Clean uploaded source files
    if (cleanUploads && fs.existsSync(config.uploadsDir)) {
      const entries = fs.readdirSync(config.uploadsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name !== '.gitkeep') {
          try {
            fs.unlinkSync(path.join(config.uploadsDir, entry.name));
            uploadsRemoved++;
          } catch {}
        }
      }
    }

    // 4. Clean output render files if requested
    if (cleanOutputs && fs.existsSync(config.outputsDir)) {
      const entries = fs.readdirSync(config.outputsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name !== '.gitkeep') {
          try {
            fs.rmSync(path.join(config.outputsDir, entry.name), { recursive: true, force: true });
            outputsRemoved++;
          } catch {}
        }
      }
    }

    const finalBreakdown = this.getStorageBreakdown();
    const freedBytes = Math.max(0, initialBreakdown.totalBytes - finalBreakdown.totalBytes);

    // Format bytes
    let freedFormatted = '0 B';
    if (freedBytes >= 1024 * 1024 * 1024) {
      freedFormatted = `${(freedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    } else if (freedBytes >= 1024 * 1024) {
      freedFormatted = `${(freedBytes / (1024 * 1024)).toFixed(1)} MB`;
    } else if (freedBytes >= 1024) {
      freedFormatted = `${(freedBytes / 1024).toFixed(0)} KB`;
    }

    logger.cleanup('info', 'MANUAL_STORAGE_PURGE', `Manual storage clean executed. Freed ${freedFormatted} (${freedBytes} bytes).`, {
      sessionsRemoved,
      workRemoved,
      uploadsRemoved,
      outputsRemoved,
      freedBytes,
    });

    return {
      freedBytes,
      freedFormatted,
      sessionsRemoved,
      workRemoved,
      uploadsRemoved,
      outputsRemoved,
    };
  }

  /**
   * Runs all cleanup tasks
   */
  public async runFullCleanup(): Promise<{ workCleaned: number; sessionsCleaned: number; logsCleaned: number }> {
    const workCleaned = await this.cleanupWorkDirectories();
    const sessionsCleaned = await this.cleanupUploadSessions();
    const logsCleaned = await this.cleanupOldLogs();

    return { workCleaned, sessionsCleaned, logsCleaned };
  }
}

export const cleanupService = new CleanupService();

