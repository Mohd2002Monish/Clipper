import crypto from 'crypto';
import path from 'path';

const ALLOWED_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v']);

export interface SanitizedFileInfo {
  originalName: string;
  sanitizedName: string;
  extension: string;
  uploadId: string;
}

export function sanitizeFilename(originalName: string): SanitizedFileInfo {
  // Extract extension
  const parsed = path.parse(originalName);
  let ext = parsed.ext.toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    ext = '.mp4'; // fallback extension
  }

  // Strip path traversal characters, null bytes, illegal filesystem chars
  // and collapse consecutive dots to prevent directory traversal edge cases
  let baseName = parsed.name
    .replace(/\0/g, '')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\.{2,}/g, '_') // replace consecutive dots like ".." with "_"
    .replace(/^\.+/, '')     // remove leading dots
    .replace(/\.+$/, '')     // remove trailing dots
    .trim();

  // Cap length to 80 chars
  if (baseName.length > 80) {
    baseName = baseName.substring(0, 80);
  }

  // If empty or invalid, assign fallback
  if (!baseName) {
    baseName = 'video_upload';
  }

  // Generate unique uploadId
  const uniqueSuffix = crypto.randomBytes(8).toString('hex');
  const uploadId = `up_${Date.now()}_${uniqueSuffix}`;
  const sanitizedName = `${baseName}_${uniqueSuffix}${ext}`;

  return {
    originalName,
    sanitizedName,
    extension: ext,
    uploadId,
  };
}

export function isAllowedVideoExtension(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}
