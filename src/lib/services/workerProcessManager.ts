import path from 'path';
import fs from 'fs';
import { spawn, execSync } from 'child_process';
import { logger } from '@/lib/logger/logger';

const PID_FILE = path.resolve(process.cwd(), '.videotimmer.worker.pid');
const LOG_FILE = path.resolve(process.cwd(), 'logs', 'worker.log');

export interface WorkerStatus {
  isRunning: boolean;
  pid?: number;
  uptimeSeconds?: number;
  startedAt?: string;
}

export class WorkerProcessManager {
  private startedAt?: Date;

  /**
   * Checks if the worker process is currently running
   */
  public isRunning(): WorkerStatus {
    if (!fs.existsSync(PID_FILE)) {
      // Secondary check: see if a worker is running via pgrep if available
      try {
        const pgrepOut = execSync('pgrep -f "src/worker/index.ts"', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        const pids = pgrepOut.split('\n').map((p) => parseInt(p.trim(), 10)).filter(Boolean);
        if (pids.length > 0 && pids[0] !== process.pid) {
          const pid = pids[0];
          fs.writeFileSync(PID_FILE, JSON.stringify({ pid, startedAt: new Date().toISOString() }), 'utf8');
          return { isRunning: true, pid };
        }
      } catch {
        // No process found or pgrep unavailable
      }
      return { isRunning: false };
    }

    try {
      const raw = fs.readFileSync(PID_FILE, 'utf8').trim();
      let pid: number | null = null;
      let startedAtStr: string | undefined = undefined;

      if (raw.startsWith('{')) {
        try {
          const parsed = JSON.parse(raw);
          pid = typeof parsed.pid === 'number' ? parsed.pid : parseInt(parsed.pid, 10);
          startedAtStr = parsed.startedAt;
        } catch {
          pid = parseInt(raw, 10);
        }
      } else {
        pid = parseInt(raw, 10);
      }

      if (!pid || isNaN(pid)) {
        this.cleanPidFile();
        return { isRunning: false };
      }

      // Check if process is alive (throws if process does not exist)
      process.kill(pid, 0);

      const startedAt = startedAtStr ? new Date(startedAtStr) : this.startedAt;
      const uptime = startedAt && !isNaN(startedAt.getTime())
        ? Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000))
        : undefined;

      return {
        isRunning: true,
        pid,
        uptimeSeconds: uptime,
        startedAt: startedAt && !isNaN(startedAt.getTime()) ? startedAt.toISOString() : undefined,
      };
    } catch {
      // Process is dead
      this.cleanPidFile();
      return { isRunning: false };
    }
  }

  /**
   * Starts the worker process in the background
   */
  public start(): { success: boolean; message: string; pid?: number } {
    const status = this.isRunning();
    if (status.isRunning) {
      return {
        success: true,
        message: `Worker is already running (PID: ${status.pid}).`,
        pid: status.pid,
      };
    }

    try {
      // Ensure logs directory exists
      const logsDir = path.dirname(LOG_FILE);
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      const outFd = fs.openSync(LOG_FILE, 'a');
      const errFd = fs.openSync(LOG_FILE, 'a');

      // Spawn worker detached from the Next.js web process
      const child = spawn('npx', ['tsx', 'src/worker/index.ts'], {
        cwd: process.cwd(),
        detached: true,
        stdio: ['ignore', outFd, errFd],
        env: {
          ...process.env,
          FORCE_COLOR: '1',
          NODE_ENV: process.env.NODE_ENV || 'development',
        },
      });

      child.unref();

      const pid = child.pid;
      if (!pid) {
        throw new Error('Failed to acquire child process PID.');
      }

      fs.writeFileSync(
        PID_FILE,
        JSON.stringify({ pid, startedAt: new Date().toISOString() }, null, 2),
        'utf8'
      );
      this.startedAt = new Date();

      logger.system('info', 'WORKER_MANUALLY_STARTED', `Rendering worker started on-demand with PID ${pid}`);

      return {
        success: true,
        message: `Rendering worker started successfully (PID: ${pid}).`,
        pid,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.system('error', 'WORKER_START_FAILED', `Failed to start rendering worker: ${msg}`);
      return {
        success: false,
        message: `Failed to start worker: ${msg}`,
      };
    }
  }

  /**
   * Stops the worker process
   */
  public stop(): { success: boolean; message: string } {
    let stoppedAny = false;

    // 1. Try stopping PID from file
    if (fs.existsSync(PID_FILE)) {
      try {
        const raw = fs.readFileSync(PID_FILE, 'utf8').trim();
        let pid: number | null = null;
        if (raw.startsWith('{')) {
          try {
            const parsed = JSON.parse(raw);
            pid = typeof parsed.pid === 'number' ? parsed.pid : parseInt(parsed.pid, 10);
          } catch {
            pid = parseInt(raw, 10);
          }
        } else {
          pid = parseInt(raw, 10);
        }

        if (pid && !isNaN(pid)) {
          try {
            // Send SIGTERM to process group or process
            try {
              process.kill(-pid, 'SIGTERM');
            } catch {
              process.kill(pid, 'SIGTERM');
            }
            stoppedAny = true;
          } catch {}
        }
      } catch {}
      this.cleanPidFile();
    }

    // 2. Safety termination: Kill any remaining "src/worker/index.ts" processes
    try {
      const pgrepOut = execSync('pgrep -f "src/worker/index.ts"', { encoding: 'utf8' }).trim();
      const pids = pgrepOut.split('\n').map((p) => parseInt(p.trim(), 10)).filter(Boolean);
      for (const p of pids) {
        if (p !== process.pid) {
          try {
            process.kill(p, 'SIGTERM');
            stoppedAny = true;
          } catch {}
        }
      }
    } catch {}

    this.startedAt = undefined;
    logger.system('info', 'WORKER_MANUALLY_STOPPED', 'Rendering worker was stopped. CPU is now idle.');

    return {
      success: true,
      message: stoppedAny
        ? 'Rendering worker stopped successfully. CPU is now idle.'
        : 'Worker was not running.',
    };
  }

  private cleanPidFile(): void {
    try {
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
      }
    } catch {}
  }
}

export const workerProcessManager = new WorkerProcessManager();
