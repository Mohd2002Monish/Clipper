import { NextRequest, NextResponse } from 'next/server';
import { chunkManager } from '@/lib/uploader/chunkManager';
import { getDiskStats } from '@/lib/system';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filename, fileSize, chunkSize, totalChunks } = body;

    if (!filename || typeof fileSize !== 'number' || typeof chunkSize !== 'number' || typeof totalChunks !== 'number') {
      return NextResponse.json(
        { error: 'Missing required parameters (filename, fileSize, chunkSize, totalChunks)' },
        { status: 400 }
      );
    }

    // Check disk space (require 2x upload size for safety)
    const disk = await getDiskStats();
    if (disk.freeBytes && disk.freeBytes < fileSize * 2) {
      logger.security('warn', 'DISK_SPACE_LOW', `Rejected upload due to insufficient disk space: ${fileSize} bytes requested`);
      return NextResponse.json(
        { error: 'Insufficient server disk space to process this video.' },
        { status: 507 }
      );
    }

    const session = chunkManager.initSession({
      originalFilename: filename,
      totalSize: fileSize,
      chunkSize,
      totalChunks,
    });

    return NextResponse.json({
      success: true,
      uploadId: session.uploadId,
      sanitizedFilename: session.sanitizedFilename,
      chunkSize: session.chunkSize,
      totalChunks: session.totalChunks,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
