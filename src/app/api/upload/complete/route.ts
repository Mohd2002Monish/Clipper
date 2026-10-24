import { NextRequest, NextResponse } from 'next/server';
import { chunkManager } from '@/lib/uploader/chunkManager';
import { probeService } from '@/lib/services/probeService';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uploadId } = body;

    if (!uploadId) {
      return NextResponse.json({ error: 'Missing uploadId parameter.' }, { status: 400 });
    }

    // Assemble file chunks into final video
    const { finalPath, meta } = chunkManager.assembleFile(uploadId);

    // Run probe service on the assembled file
    let probeData = null;
    try {
      probeData = await probeService.probeVideo(finalPath);
    } catch (probeErr: unknown) {
      const probeMsg = probeErr instanceof Error ? probeErr.message : String(probeErr);
      logger.error('api', 'PROBE_AFTER_UPLOAD_FAILED', `Failed to probe assembled file: ${probeMsg}`);
      // Even if probe fails (e.g. ffprobe not found in local dev), return assembled file with fallback
    }

    return NextResponse.json({
      success: true,
      uploadId,
      originalFilename: meta.originalFilename,
      sanitizedFilename: meta.sanitizedFilename,
      storedPath: finalPath,
      sizeBytes: meta.totalSize,
      probe: probeData,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
