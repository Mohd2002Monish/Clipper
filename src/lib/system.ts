import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import { config } from './config';

const execFileAsync = promisify(execFile);

export interface SystemHealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptimeSeconds: number;
  ffmpeg: {
    available: boolean;
    path: string;
    version?: string;
    error?: string;
  };
  ffprobe: {
    available: boolean;
    path: string;
    version?: string;
    error?: string;
  };
  disk: {
    storagePath: string;
    freeBytes?: number;
    totalBytes?: number;
    usagePercent?: number;
    isSpaceAvailable: boolean;
  };
  memory: {
    freeMb: number;
    totalMb: number;
    usedPercent: number;
  };
  cpu: {
    cores: number;
    model: string;
    loadAvg: number[];
  };
}

export async function checkFfmpegBinary(): Promise<{ available: boolean; path: string; version?: string; error?: string }> {
  const binaryPath = config.ffmpegPath;
  try {
    const { stdout } = await execFileAsync(binaryPath, ['-version']);
    const match = stdout.match(/ffmpeg version ([^\s]+)/i);
    return {
      available: true,
      path: binaryPath,
      version: match ? match[1] : 'detected',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      available: false,
      path: binaryPath,
      error: errorMsg,
    };
  }
}

export async function checkFfprobeBinary(): Promise<{ available: boolean; path: string; version?: string; error?: string }> {
  const binaryPath = config.ffprobePath;
  try {
    const { stdout } = await execFileAsync(binaryPath, ['-version']);
    const match = stdout.match(/ffprobe version ([^\s]+)/i);
    return {
      available: true,
      path: binaryPath,
      version: match ? match[1] : 'detected',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      available: false,
      path: binaryPath,
      error: errorMsg,
    };
  }
}

export async function getDiskStats(targetDir: string = config.storageDir) {
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    // Cross-platform disk stats using statfs if supported, fallback to basic check
    const statfs = fs.statfsSync ? fs.statfsSync(targetDir) : null;
    if (statfs) {
      const free = statfs.bavail * statfs.bsize;
      const total = statfs.blocks * statfs.bsize;
      const used = total - free;
      const usagePercent = Math.round((used / total) * 100);
      return {
        freeBytes: free,
        totalBytes: total,
        usagePercent,
        isSpaceAvailable: free > 1024 * 1024 * 500, // at least 500MB free
      };
    }
  } catch {
    // Statfs may not be available on all node versions
  }

  return {
    isSpaceAvailable: true,
  };
}

export async function getSystemHealth(): Promise<SystemHealthReport> {
  const [ffmpegRes, ffprobeRes, diskRes] = await Promise.all([
    checkFfmpegBinary(),
    checkFfprobeBinary(),
    getDiskStats(),
  ]);

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  const isHealthy = ffmpegRes.available && ffprobeRes.available && diskRes.isSpaceAvailable;
  const isDegraded = !ffmpegRes.available || !ffprobeRes.available;

  return {
    status: isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(os.uptime()),
    ffmpeg: ffmpegRes,
    ffprobe: ffprobeRes,
    disk: {
      storagePath: config.storageDir,
      ...diskRes,
    },
    memory: {
      totalMb: Math.round(totalMem / (1024 * 1024)),
      freeMb: Math.round(freeMem / (1024 * 1024)),
      usedPercent: Math.round((usedMem / totalMem) * 100),
    },
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0]?.model || 'Unknown CPU',
      loadAvg: os.loadavg(),
    },
  };
}
