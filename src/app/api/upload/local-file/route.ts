import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { probeService } from '@/lib/services/probeService';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { filePath } = body;

    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid filePath parameter.' }, { status: 400 });
    }

    filePath = filePath.trim();

    // Expand ~ to user home directory
    if (filePath.startsWith('~/') || filePath === '~') {
      filePath = path.join(os.homedir(), filePath.slice(1));
    }

    // Resolve relative path
    const resolvedPath = path.resolve(filePath);

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: `File not found on your computer at: ${resolvedPath}` }, { status: 404 });
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: `Specified path is a directory, not a video file: ${resolvedPath}` }, { status: 400 });
    }

    // Validate video extension
    const ext = path.extname(resolvedPath).toLowerCase();
    const validExts = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v', '.ts', '.flv'];
    if (!validExts.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported video format "${ext}". Supported extensions: ${validExts.join(', ')}` },
        { status: 400 }
      );
    }

    // Probe the file directly on disk via ffprobe in milliseconds
    logger.system('info', 'LOCAL_FILE_PROBING', `Probing local video file directly at: ${resolvedPath}`);
    const probeData = await probeService.probeVideo(resolvedPath);

    return NextResponse.json({
      success: true,
      uploadId: `local_${Date.now()}`,
      originalFilename: path.basename(resolvedPath),
      sanitizedFilename: resolvedPath,
      storedPath: resolvedPath,
      sizeBytes: stat.size,
      probe: probeData,
      isDirectLocal: true,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.system('error', 'LOCAL_FILE_PROBE_ERROR', errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
