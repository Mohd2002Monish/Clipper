import { NextRequest, NextResponse } from 'next/server';
import archiver from 'archiver';
import fs from 'fs';
import { PassThrough } from 'stream';
import { connectMongo } from '@/lib/db';
import { Job } from '@/models/Job';
import { Part } from '@/models/Part';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    await connectMongo();
    const job = await Job.findById(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const parts = await Part.find({
      jobId,
      status: { $in: ['rendered', 'uploaded'] },
    }).sort({ index: 1 });

    if (parts.length === 0) {
      return NextResponse.json(
        { error: 'No rendered parts available for download yet.' },
        { status: 400 }
      );
    }

    // Verify at least one file exists on disk
    const existingParts = parts.filter(
      (p) => p.localPath && fs.existsSync(p.localPath)
    );

    if (existingParts.length === 0) {
      return NextResponse.json(
        { error: 'Rendered video files are no longer on local disk (may have been uploaded to Drive or cleaned up).' },
        { status: 404 }
      );
    }

    const baseName = (job.source?.originalName || 'video')
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipFilename = `${baseName}_parts.zip`;

    logger.system('info', 'ZIP_DOWNLOAD_START', `Packaging ${existingParts.length} parts for job ${jobId} into ZIP`);

    const archive = archiver('zip', {
      zlib: { level: 0 }, // Store without re-compressing already-compressed H.264 video
    });

    const stream = new PassThrough();
    archive.pipe(stream);

    for (const part of existingParts) {
      if (part.localPath && fs.existsSync(part.localPath)) {
        archive.file(part.localPath, { name: part.filename });
      }
    }

    archive.finalize().catch((err) => {
      logger.system('error', 'ZIP_ARCHIVE_ERROR', `Failed finalizing zip for job ${jobId}: ${err.message}`);
    });

    // Convert PassThrough Node stream into web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        stream.on('end', () => {
          controller.close();
        });
        stream.on('error', (err) => {
          controller.error(err);
        });
      },
      cancel() {
        stream.destroy();
      },
    });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.system('error', 'ZIP_DOWNLOAD_ROUTE_ERROR', errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
