import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { config } from '@/lib/config';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No thumbnail image file provided.' }, { status: 400 });
    }

    const uploadsDir = config.uploadsDir;
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = (path.extname(file.name) || '.jpg').toLowerCase();
    const imageExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const videoExts = ['.mp4', '.mov', '.webm', '.mkv'];
    const validExts = [...imageExts, ...videoExts];
    if (!validExts.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported media format "${ext}". Supported thumbnail formats: ${validExts.join(', ')}` },
        { status: 400 }
      );
    }

    const isVideo = videoExts.includes(ext);
    const mediaType = isVideo ? 'video' : 'image';
    const safeBase = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uploadId = `thumb_${Date.now()}`;
    const savedFilename = `${uploadId}_${safeBase}${ext}`;
    const destinationPath = path.join(uploadsDir, savedFilename);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(destinationPath, buffer);

    logger.system('info', 'THUMBNAIL_UPLOAD_SUCCESS', `Saved thumbnail media: ${savedFilename} (${buffer.length} bytes, type: ${mediaType})`);

    const imageUrl = `/api/video/${savedFilename}`;

    return NextResponse.json({
      success: true,
      originalFilename: file.name,
      savedFilename,
      storedPath: destinationPath,
      imageUrl,
      mediaType,
      sizeBytes: buffer.length,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.system('error', 'THUMBNAIL_UPLOAD_ERROR', errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

