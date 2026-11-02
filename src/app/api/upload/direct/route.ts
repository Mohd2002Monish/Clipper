import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { config } from '@/lib/config';
import { probeService } from '@/lib/services/probeService';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No video file provided.' }, { status: 400 });
    }

    const uploadsDir = config.uploadsDir;
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Validate video file extension
    const ext = (path.extname(file.name) || '.mp4').toLowerCase();
    const validExts = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v'];
    if (!validExts.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported video format "${ext}". Supported formats: ${validExts.join(', ')}` },
        { status: 400 }
      );
    }

    // Sanitize filename and create unique destination path
    const safeBase = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uploadId = `upload_${Date.now()}`;
    const savedFilename = `${uploadId}_${safeBase}${ext}`;
    const destinationPath = path.join(uploadsDir, savedFilename);

    // Write file buffer to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(destinationPath, buffer);

    logger.system('info', 'DIRECT_UPLOAD_SUCCESS', `Saved video file: ${savedFilename} (${buffer.length} bytes)`);

    // Probe file for metadata (dimensions, duration) if ffprobe is available
    let probe = null;
    try {
      probe = await probeService.probeVideo(destinationPath);
    } catch {
      // Non-fatal if ffprobe unavailable
    }

    // Streamable URL through Next.js /api/video/ endpoint
    const downloadUrl = `/api/video/${savedFilename}`;

    return NextResponse.json({
      success: true,
      uploadId,
      originalFilename: file.name,
      savedFilename,
      storedPath: destinationPath,
      downloadUrl,
      sizeBytes: buffer.length,
      probe,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.system('error', 'DIRECT_UPLOAD_ERROR', errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

