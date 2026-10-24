import { spawn, ChildProcess } from 'child_process';
import readline from 'readline';
import { config } from '../config';
import { logger } from '../logger/logger';

export interface FFmpegRunOptions {
  args: string[];
  jobId: string;
  partIndex: number;
  partDuration: number;
  onProgress?: (progressPercent: number, fps: number, currentTimeSec: number) => void;
  timeoutMs?: number;
}

export interface FFmpegRunResult {
  exitCode: number;
  elapsedMs: number;
  lastStderrLines: string[];
}

export class FFmpegRunner {
  private ffmpegPath: string;

  constructor() {
    this.ffmpegPath = config.ffmpegPath;
  }

  public run(options: FFmpegRunOptions): { promise: Promise<FFmpegRunResult>; cancel: () => void } {
    const { args, jobId, partIndex, partDuration, onProgress } = options;
    const startTime = Date.now();

    // Default timeout: scaled by duration (minimum 60s, or 8x duration)
    const timeoutMs = options.timeoutMs || Math.max(60000, partDuration * 8000);

    const partPadded = String(partIndex).padStart(2, '0');
    logger.render('info', 'FFMPEG_START', `Starting render for part ${partPadded} (target dur: ${partDuration}s)`, jobId, partIndex, 0, {
      args,
    });

    let child: ChildProcess | null = null;
    let isCancelled = false;
    let timeoutTimer: NodeJS.Timeout | null = null;
    const lastStderrLines: string[] = [];

    const promise = new Promise<FFmpegRunResult>((resolve, reject) => {
      // Spawn without shell to prevent command injection
      child = spawn(this.ffmpegPath, args, {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      timeoutTimer = setTimeout(() => {
        if (child && !child.killed) {
          logger.render('error', 'FFMPEG_TIMEOUT', `Part ${partPadded} exceeded timeout of ${timeoutMs}ms. Killing process.`, jobId, partIndex);
          child.kill('SIGKILL');
          reject(new Error(`Render timed out after ${Math.round(timeoutMs / 1000)}s`));
        }
      }, timeoutMs);

      // Parse stdout for `-progress pipe:1`
      if (child.stdout) {
        const rl = readline.createInterface({ input: child.stdout });
        let outTimeUs = 0;
        let fps = 0;

        rl.on('line', (line) => {
          const parts = line.split('=');
          if (parts.length === 2) {
            const key = parts[0].trim();
            const val = parts[1].trim();

            if (key === 'out_time_us') {
              outTimeUs = parseInt(val, 10) || 0;
            } else if (key === 'fps') {
              fps = parseFloat(val) || 0;
            } else if (key === 'progress' && val === 'continue') {
              const currentSec = outTimeUs / 1000000;
              const percent = Math.min(99, Math.max(0, Math.round((currentSec / partDuration) * 100)));
              onProgress?.(percent, fps, currentSec);
            }
          }
        });
      }

      // Stream stderr to raw ffmpeg log file and buffer last lines
      if (child.stderr) {
        const errRl = readline.createInterface({ input: child.stderr });
        errRl.on('line', (line) => {
          logger.logFfmpegStderr(jobId, partIndex, line);

          lastStderrLines.push(line);
          if (lastStderrLines.length > 25) {
            lastStderrLines.shift();
          }
        });
      }

      child.on('error', (err) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        logger.render('error', 'FFMPEG_SPAWN_ERROR', `Failed to start FFmpeg: ${err.message}`, jobId, partIndex, undefined, {
          err,
        });
        reject(err);
      });

      child.on('close', (code) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        const elapsedMs = Date.now() - startTime;

        if (isCancelled) {
          logger.render('warn', 'FFMPEG_CANCELLED', `Part ${partPadded} render was cancelled.`, jobId, partIndex, elapsedMs);
          reject(new Error('Render cancelled by user.'));
          return;
        }

        if (code === 0) {
          onProgress?.(100, 0, partDuration);
          logger.render('info', 'FFMPEG_SUCCESS', `Part ${partPadded} rendered successfully in ${elapsedMs}ms`, jobId, partIndex, elapsedMs);
          resolve({
            exitCode: 0,
            elapsedMs,
            lastStderrLines,
          });
        } else {
          logger.render('error', 'FFMPEG_EXIT_NONZERO', `FFmpeg exited with error code ${code}`, jobId, partIndex, elapsedMs, {
            exitCode: code,
            lastStderr: lastStderrLines.slice(-5),
          });
          reject(
            new Error(
              `FFmpeg failed with exit code ${code}. Last output: ${lastStderrLines.slice(-3).join(' | ')}`
            )
          );
        }
      });
    });

    const cancel = () => {
      isCancelled = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (child && !child.killed) {
        logger.render('info', 'FFMPEG_KILL_REQUEST', `Killing FFmpeg for part ${partIndex}`, jobId, partIndex);
        child.kill('SIGTERM');
        // Escalate to SIGKILL if not dead after 1.5s
        setTimeout(() => {
          if (child && !child.killed) {
            child.kill('SIGKILL');
          }
        }, 1500);
      }
    };

    return { promise, cancel };
  }
}

export const ffmpegRunner = new FFmpegRunner();
