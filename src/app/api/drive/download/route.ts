import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { config } from '@/lib/config';
import { driveService } from '@/lib/services/driveService';
import { probeService } from '@/lib/services/probeService';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { fileId, fileName } = body;

    if (!fileId || typeof fileId !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing or invalid fileId parameter.' }, { status: 400 });
    }

    const drive = await driveService.getAuthenticatedDrive();
    if (!drive) {
      return NextResponse.json(
        { success: false, error: 'Google Drive is not authenticated or access token has expired.' },
        { status: 401 }
      );
    }

    // 1. Prepare local cache destination
    const safeName = (fileName || 'video.mp4')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_');
    const driveCacheDir = path.join(config.uploadsDir, 'drive');
    if (!fs.existsSync(driveCacheDir)) {
      fs.mkdirSync(driveCacheDir, { recursive: true });
    }

    const destPath = path.join(driveCacheDir, `drive_${fileId}_${safeName}`);
    let isCached = false;

    // 2. Check if local copy already exists and is non-empty
    if (fs.existsSync(destPath)) {
      const existingStat = fs.statSync(destPath);
      if (existingStat.size > 1024) {
        isCached = true;
        logger.drive('info', 'DRIVE_CACHE_HIT', `Using existing local copy for Drive file ${fileId} at: ${destPath}`);
      }
    }

    // 3. Stream download from Drive if not cached
    if (!isCached) {
      logger.drive('info', 'DRIVE_DOWNLOAD_START', `Streaming download for Drive file ${fileId} (${safeName}) to: ${destPath}`);
      await driveService.downloadFile(fileId, destPath);
      logger.drive('info', 'DRIVE_DOWNLOAD_FINISH', `Completed download for Drive file ${fileId}`);
    }

    if (!fs.existsSync(destPath)) {
      return NextResponse.json({ success: false, error: 'Failed to verify downloaded video on local disk.' }, { status: 500 });
    }

    const stat = fs.statSync(destPath);

    // 4. Extract video metadata via ffprobe
    logger.system('info', 'DRIVE_VIDEO_PROBING', `Probing downloaded Drive video: ${destPath}`);
    const probeData = await probeService.probeVideo(destPath);

    return NextResponse.json({
      success: true,
      uploadId: `drive_${fileId}`,
      originalFilename: fileName || path.basename(destPath),
      sanitizedFilename: destPath,
      storedPath: destPath,
      sizeBytes: stat.size,
      probe: probeData,
      isDirectLocal: true,
      isCached,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.drive('error', 'DRIVE_DOWNLOAD_FAILED', errorMsg);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
