import fs from 'fs';
import path from 'path';

const LOG_FILE = path.resolve(process.cwd(), 'logs', 'idm_extension.log');

export interface IdmLogEntry {
  level: 'info' | 'progress' | 'success' | 'warn' | 'error';
  event: string;
  url?: string;
  jobId?: string;
  message: string;
  data?: Record<string, unknown>;
}

export class IdmLogger {
  private static ensureLogFile() {
    try {
      const dir = path.dirname(LOG_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {}
  }

  public static log(entry: IdmLogEntry) {
    this.ensureLogFile();
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.event}]`;
    const details = entry.data ? ` | ${JSON.stringify(entry.data)}` : '';
    const line = `${prefix} ${entry.message}${details}\n`;

    try {
      fs.appendFileSync(LOG_FILE, line, 'utf8');
    } catch (err) {
      console.error('[IdmLogger Error]', err);
    }
  }

  public static info(event: string, message: string, data?: Record<string, unknown>) {
    this.log({ level: 'info', event, message, data });
  }

  public static progress(event: string, message: string, data?: Record<string, unknown>) {
    this.log({ level: 'progress', event, message, data });
  }

  public static success(event: string, message: string, data?: Record<string, unknown>) {
    this.log({ level: 'success', event, message, data });
  }

  public static error(event: string, message: string, data?: Record<string, unknown>) {
    this.log({ level: 'error', event, message, data });
  }

  public static getRecentLogs(limit: number = 100): string[] {
    try {
      if (!fs.existsSync(LOG_FILE)) return [];
      const content = fs.readFileSync(LOG_FILE, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines.slice(-limit);
    } catch {
      return [];
    }
  }

  public static clearLogs() {
    try {
      this.ensureLogFile();
      fs.writeFileSync(LOG_FILE, '', 'utf8');
    } catch {}
  }
}

