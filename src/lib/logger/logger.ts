import fs from 'fs';
import path from 'path';
import os from 'os';
import { config } from '../config';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogService = 'api' | 'worker';
export type LogChannel =
  | 'app'
  | 'access'
  | 'error'
  | 'upload'
  | 'probe'
  | 'plan'
  | 'queue'
  | 'render'
  | 'verify'
  | 'drive'
  | 'cleanup'
  | 'audit'
  | 'security'
  | 'system';

export interface LogEntry {
  timestamp: string; // ISO 8601 UTC
  level: LogLevel;
  service: LogService;
  channel: LogChannel;
  event: string;
  message: string;
  jobId?: string;
  partIndex?: number;
  requestId?: string;
  durationMs?: number;
  data?: Record<string, unknown>;
}

// User home directory regex for path redaction
const userHome = os.homedir();
const homeRegex = new RegExp(userHome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');

// Redaction utility
function redactValue(key: string, val: unknown): unknown {
  if (typeof val === 'string') {
    // Redact user home paths
    let sanitized = val.replace(homeRegex, '~');

    // Redact tokens/secrets
    const sensitiveKeyPatterns = /token|secret|password|auth|authorization|credential|key/i;
    if (sensitiveKeyPatterns.test(key)) {
      if (sanitized.length > 8) {
        sanitized = sanitized.substring(0, 4) + '...' + sanitized.substring(sanitized.length - 4);
      } else {
        sanitized = '***REDACTED***';
      }
    }
    return sanitized;
  }

  if (Array.isArray(val)) {
    return val.map((item, idx) => redactValue(`${key}[${idx}]`, item));
  }

  if (val !== null && typeof val === 'object') {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      res[k] = redactValue(k, v);
    }
    return res;
  }

  return val;
}

export class LoggerService {
  private logDir: string;

  constructor(logDir: string = config.logDir) {
    this.logDir = logDir;
    this.ensureDirs();
  }

  private ensureDirs() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      const jobsDir = path.join(this.logDir, 'jobs');
      if (!fs.existsSync(jobsDir)) {
        fs.mkdirSync(jobsDir, { recursive: true });
      }
      const ffmpegDir = path.join(this.logDir, 'ffmpeg');
      if (!fs.existsSync(ffmpegDir)) {
        fs.mkdirSync(ffmpegDir, { recursive: true });
      }
    } catch {
      // Ignore during build/bootstrap
    }
  }

  private appendLine(filePath: string, line: string) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.appendFileSync(filePath, line + '\n', 'utf8');
    } catch (err) {
      console.error(`Failed writing to log file ${filePath}:`, err);
    }
  }

  public log(entryInput: Omit<LogEntry, 'timestamp'>) {
    const timestamp = new Date().toISOString();
    const entry: LogEntry = {
      timestamp,
      level: entryInput.level,
      service: entryInput.service,
      channel: entryInput.channel,
      event: entryInput.event,
      message: String(redactValue('message', entryInput.message)),
      jobId: entryInput.jobId,
      partIndex: entryInput.partIndex,
      requestId: entryInput.requestId,
      durationMs: entryInput.durationMs,
      data: entryInput.data ? (redactValue('data', entryInput.data) as Record<string, unknown>) : undefined,
    };

    const jsonLine = JSON.stringify(entry);

    // 1. Channel-specific log file: e.g. logs/app.log, logs/render.log
    const channelLogPath = path.join(this.logDir, `${entry.channel}.log`);
    this.appendLine(channelLogPath, jsonLine);

    // 2. Also write errors to logs/error.log if level is 'error' and not already error channel
    if (entry.level === 'error' && entry.channel !== 'error') {
      const errorLogPath = path.join(this.logDir, 'error.log');
      this.appendLine(errorLogPath, jsonLine);
    }

    // 3. Per-job aggregate log: logs/jobs/<jobId>.log
    if (entry.jobId) {
      const jobLogPath = path.join(this.logDir, 'jobs', `${entry.jobId}.log`);
      this.appendLine(jobLogPath, jsonLine);
    }

    // 4. Console output in dev
    if (!config.isProd) {
      const color =
        entry.level === 'error' ? '\x1b[31m' : entry.level === 'warn' ? '\x1b[33m' : '\x1b[36m';
      const reset = '\x1b[0m';
      console.log(
        `${color}[${entry.level.toUpperCase()}][${entry.service}:${entry.channel}]${reset} ` +
          `${entry.event} - ${entry.message}` +
          (entry.jobId ? ` (job: ${entry.jobId}${entry.partIndex !== undefined ? ` part: ${entry.partIndex}` : ''})` : '')
      );
    }
  }

  // Write raw FFmpeg stderr for a specific part
  public logFfmpegStderr(jobId: string, partIndex: number, stderrLine: string) {
    const partPadded = String(partIndex).padStart(2, '0');
    const jobFfmpegDir = path.join(this.logDir, 'ffmpeg', jobId);
    const ffmpegPartLog = path.join(jobFfmpegDir, `part${partPadded}.log`);
    this.appendLine(ffmpegPartLog, stderrLine);
  }

  // Helper shortcuts
  public app(level: LogLevel, event: string, message: string, data?: Record<string, unknown>) {
    this.log({ service: 'api', channel: 'app', level, event, message, data });
  }

  public access(data: { method: string; path: string; status: number; durationMs: number; ip?: string; userAgent?: string; requestId?: string }) {
    this.log({
      service: 'api',
      channel: 'access',
      level: 'info',
      event: 'HTTP_REQUEST',
      message: `${data.method} ${data.path} ${data.status} - ${data.durationMs}ms`,
      durationMs: data.durationMs,
      requestId: data.requestId,
      data,
    });
  }

  public error(service: LogService, event: string, message: string, err?: Error | unknown, jobId?: string) {
    const errorDetails = err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { raw: err };
    this.log({
      service,
      channel: 'error',
      level: 'error',
      event,
      message,
      jobId,
      data: errorDetails,
    });
  }

  public upload(level: LogLevel, event: string, message: string, jobId?: string, data?: Record<string, unknown>) {
    this.log({ service: 'api', channel: 'upload', level, event, message, jobId, data });
  }

  public probe(level: LogLevel, event: string, message: string, jobId?: string, data?: Record<string, unknown>) {
    this.log({ service: 'worker', channel: 'probe', level, event, message, jobId, data });
  }

  public plan(level: LogLevel, event: string, message: string, jobId?: string, data?: Record<string, unknown>) {
    this.log({ service: 'worker', channel: 'plan', level, event, message, jobId, data });
  }

  public queue(level: LogLevel, event: string, message: string, jobId?: string, data?: Record<string, unknown>) {
    this.log({ service: 'api', channel: 'queue', level, event, message, jobId, data });
  }

  public render(level: LogLevel, event: string, message: string, jobId?: string, partIndex?: number, durationMs?: number, data?: Record<string, unknown>) {
    this.log({ service: 'worker', channel: 'render', level, event, message, jobId, partIndex, durationMs, data });
  }

  public verify(level: LogLevel, event: string, message: string, jobId?: string, partIndex?: number, data?: Record<string, unknown>) {
    this.log({ service: 'worker', channel: 'verify', level, event, message, jobId, partIndex, data });
  }

  public drive(level: LogLevel, event: string, message: string, jobId?: string, partIndex?: number, data?: Record<string, unknown>) {
    this.log({ service: 'worker', channel: 'drive', level, event, message, jobId, partIndex, data });
  }

  public cleanup(level: LogLevel, event: string, message: string, data?: Record<string, unknown>) {
    this.log({ service: 'worker', channel: 'cleanup', level, event, message, data });
  }

  public audit(event: string, message: string, data?: Record<string, unknown>) {
    this.log({ service: 'api', channel: 'audit', level: 'info', event, message, data });
  }

  public security(level: LogLevel, event: string, message: string, data?: Record<string, unknown>) {
    this.log({ service: 'api', channel: 'security', level, event, message, data });
  }

  public system(level: LogLevel, event: string, message: string, data?: Record<string, unknown>) {
    this.log({ service: 'api', channel: 'system', level, event, message, data });
  }

  // Read job logs
  public getJobLogs(jobId: string): LogEntry[] {
    const jobLogPath = path.join(this.logDir, 'jobs', `${jobId}.log`);
    if (!fs.existsSync(jobLogPath)) return [];
    const content = fs.readFileSync(jobLogPath, 'utf8');
    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as LogEntry[];
  }
}

export const logger = new LoggerService();
