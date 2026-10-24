import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from '../logger/logger';
import { sanitizeFilename, isAllowedVideoExtension } from './sanitize';
import { validateVideoFileSignature } from './fileType';

export interface UploadSessionMeta {
  uploadId: string;
  originalFilename: string;
  sanitizedFilename: string;
  extension: string;
  totalSize: number;
  chunkSize: number;
  totalChunks: number;
  receivedChunks: number[];
  createdAt: string;
  updatedAt: string;
}

export class ChunkManager {
  private baseDir: string;
  private sessionsDir: string;

  constructor() {
    this.baseDir = config.uploadsDir;
    this.sessionsDir = path.join(this.baseDir, '.sessions');
    this.ensureDirs();
  }

  private ensureDirs() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  private getSessionPath(uploadId: string): string {
    return path.join(this.sessionsDir, uploadId);
  }

  private getMetaPath(uploadId: string): string {
    return path.join(this.getSessionPath(uploadId), 'metadata.json');
  }

  public initSession(params: {
    originalFilename: string;
    totalSize: number;
    chunkSize: number;
    totalChunks: number;
  }): UploadSessionMeta {
    if (!isAllowedVideoExtension(params.originalFilename)) {
      logger.security('warn', 'UPLOAD_REJECTED_EXT', `Rejected upload with illegal extension: ${params.originalFilename}`, {
        filename: params.originalFilename,
      });
      throw new Error(`File extension not supported. Allowed formats: mp4, mov, mkv, webm, avi, m4v.`);
    }

    if (params.totalSize <= 0) {
      throw new Error('File size must be greater than 0 bytes.');
    }

    if (params.totalSize > config.maxUploadSizeBytes) {
      const maxMb = Math.round(config.maxUploadSizeBytes / (1024 * 1024));
      logger.security('warn', 'UPLOAD_REJECTED_SIZE', `Upload exceeds max allowed size of ${maxMb}MB`, {
        size: params.totalSize,
        maxSizeBytes: config.maxUploadSizeBytes,
      });
      throw new Error(`File size exceeds maximum limit of ${maxMb}MB.`);
    }

    const { sanitizedName, extension, uploadId } = sanitizeFilename(params.originalFilename);
    const sessionDir = this.getSessionPath(uploadId);
    fs.mkdirSync(sessionDir, { recursive: true });

    const meta: UploadSessionMeta = {
      uploadId,
      originalFilename: params.originalFilename,
      sanitizedFilename: sanitizedName,
      extension,
      totalSize: params.totalSize,
      chunkSize: params.chunkSize,
      totalChunks: params.totalChunks,
      receivedChunks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(this.getMetaPath(uploadId), JSON.stringify(meta, null, 2), 'utf8');

    logger.upload('info', 'UPLOAD_INIT', `Initialized upload session for ${params.originalFilename}`, uploadId, {
      totalSize: params.totalSize,
      totalChunks: params.totalChunks,
      chunkSize: params.chunkSize,
    });

    return meta;
  }

  public getSession(uploadId: string): UploadSessionMeta | null {
    const metaPath = this.getMetaPath(uploadId);
    if (!fs.existsSync(metaPath)) return null;
    try {
      const data = fs.readFileSync(metaPath, 'utf8');
      return JSON.parse(data) as UploadSessionMeta;
    } catch {
      return null;
    }
  }

  public saveChunk(uploadId: string, chunkIndex: number, chunkBuffer: Buffer): { receivedChunks: number[]; isComplete: boolean } {
    const meta = this.getSession(uploadId);
    if (!meta) {
      throw new Error(`Upload session "${uploadId}" not found or expired.`);
    }

    if (chunkIndex < 0 || chunkIndex >= meta.totalChunks) {
      throw new Error(`Invalid chunk index ${chunkIndex}. Total expected: ${meta.totalChunks}`);
    }

    const chunkPath = path.join(this.getSessionPath(uploadId), `chunk_${chunkIndex}`);
    fs.writeFileSync(chunkPath, chunkBuffer);

    if (!meta.receivedChunks.includes(chunkIndex)) {
      meta.receivedChunks.push(chunkIndex);
      meta.receivedChunks.sort((a, b) => a - b);
    }
    meta.updatedAt = new Date().toISOString();

    fs.writeFileSync(this.getMetaPath(uploadId), JSON.stringify(meta, null, 2), 'utf8');

    logger.upload('info', 'CHUNK_RECEIVED', `Received chunk ${chunkIndex + 1}/${meta.totalChunks} (${chunkBuffer.length} bytes)`, uploadId, {
      chunkIndex,
      chunkBytes: chunkBuffer.length,
      receivedCount: meta.receivedChunks.length,
      totalChunks: meta.totalChunks,
    });

    return {
      receivedChunks: meta.receivedChunks,
      isComplete: meta.receivedChunks.length === meta.totalChunks,
    };
  }

  public assembleFile(uploadId: string): { finalPath: string; meta: UploadSessionMeta } {
    const meta = this.getSession(uploadId);
    if (!meta) {
      throw new Error(`Upload session "${uploadId}" not found.`);
    }

    if (meta.receivedChunks.length !== meta.totalChunks) {
      throw new Error(`Cannot assemble file: only ${meta.receivedChunks.length} of ${meta.totalChunks} chunks received.`);
    }

    const finalPath = path.join(this.baseDir, meta.sanitizedFilename);
    const sessionDir = this.getSessionPath(uploadId);

    // Write chunks sequentially using synchronous file descriptor to guarantee immediate flush
    const fd = fs.openSync(finalPath, 'w');

    try {
      for (let i = 0; i < meta.totalChunks; i++) {
        const chunkPath = path.join(sessionDir, `chunk_${i}`);
        if (!fs.existsSync(chunkPath)) {
          throw new Error(`Missing chunk_${i} on disk during assembly.`);
        }
        const chunkData = fs.readFileSync(chunkPath);
        fs.writeSync(fd, chunkData, 0, chunkData.length);
      }
    } finally {
      fs.closeSync(fd);
    }

    // Verify file signature
    const sigCheck = validateVideoFileSignature(finalPath);
    if (!sigCheck.isValid) {
      if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
      logger.security('error', 'FILE_SIGNATURE_INVALID', `Uploaded file failed signature validation: ${sigCheck.error}`, {
        uploadId,
        error: sigCheck.error,
      });
      throw new Error(`Invalid file content: ${sigCheck.error}`);
    }

    // Clean up temporary chunks folder
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }

    logger.upload('info', 'UPLOAD_ASSEMBLED', `File successfully assembled at ${finalPath}`, uploadId, {
      finalPath,
      sizeBytes: fs.statSync(finalPath).size,
      format: sigCheck.detectedFormat,
    });

    return { finalPath, meta };
  }

  public abortSession(uploadId: string): boolean {
    const sessionDir = this.getSessionPath(uploadId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      logger.upload('info', 'UPLOAD_ABORTED', `Upload session aborted and temporary chunks cleaned up.`, uploadId);
      return true;
    }
    return false;
  }
}

export const chunkManager = new ChunkManager();
