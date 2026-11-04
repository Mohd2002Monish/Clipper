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
      return NextResponse.json({ error: 'No image file provided.' }, { status: 400 });
    }

    const uploadsDir = config.uploadsDir;
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = (path.extname(file.name) || '.jpg').toLowerCase();
    const validExts = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
    if (!validExts.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported image format "${ext}". Supported formats: ${validExts.join(', ')}` },
        { status: 400 }
      );
    }

    const safeBase = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uploadId = `bg_${Date.now()}`;
    const savedFilename = `${uploadId}_${safeBase}${ext}`;
    const destinationPath = path.join(uploadsDir, savedFilename);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(destinationPath, buffer);

    logger.system('info', 'BG_IMAGE_UPLOAD_SUCCESS', `Saved background image: ${savedFilename} (${buffer.length} bytes)`);

    const imageUrl = `/api/video/${savedFilename}`;

    return NextResponse.json({
      success: true,
      originalFilename: file.name,
      savedFilename,
      storedPath: destinationPath,
      imageUrl,
      sizeBytes: buffer.length,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.system('error', 'BG_IMAGE_UPLOAD_ERROR', errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

