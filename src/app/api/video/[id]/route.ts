import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await params;
  const fileId = resolvedParams?.id || '';

  // 1. Check for explicit filePath query parameter or decoded base64 path
  const searchParams = req.nextUrl.searchParams;
  const explicitPath = searchParams.get('filePath');

  let targetFile = '';

  if (explicitPath && fs.existsSync(explicitPath)) {
    targetFile = explicitPath;
  } else {
    // Try base64 decoding fileId if it represents an encoded path
    try {
      const decoded = Buffer.from(fileId, 'base64url').toString('utf8');
      if (fs.existsSync(decoded)) {
        targetFile = decoded;
      }
    } catch {
      // not base64
    }

    if (!targetFile) {
      if (fs.existsSync(fileId) && !fileId.includes('..')) {
        targetFile = fileId;
      } else {
        const uploadsDir = config.uploadsDir;
        const candidate = path.join(uploadsDir, fileId);
        if (fs.existsSync(candidate)) {
          targetFile = candidate;
        } else if (fs.existsSync(uploadsDir)) {
          const files = fs.readdirSync(uploadsDir);
          const matched = files.find((f) => f.startsWith(fileId));
          if (matched) {
            targetFile = path.join(uploadsDir, matched);
          }
        }
      }
    }
  }

  if (!targetFile || !fs.existsSync(targetFile)) {
    return NextResponse.json({ error: 'Video file not found.' }, { status: 404 });
  }

  const stat = fs.statSync(targetFile);
  const fileSize = stat.size;
  const rangeHeader = req.headers.get('range');

  const ext = path.extname(targetFile).toLowerCase();
  let contentType = 'video/mp4';
  if (ext === '.webm') contentType = 'video/webm';
  else if (ext === '.mov') contentType = 'video/quicktime';
  else if (ext === '.mkv') contentType = 'video/x-matroska';

  if (!rangeHeader) {
    const fileStream = fs.createReadStream(targetFile);
    return new NextResponse(fileStream as any, {
      status: 200,
      headers: {
        'Content-Length': String(fileSize),
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      },
    });
  }

  // Parse Range header (e.g. "bytes=0-1048576")
  const parts = rangeHeader.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
  const chunksize = end - start + 1;

  const fileStream = fs.createReadStream(targetFile, { start, end });

  return new NextResponse(fileStream as any, {
    status: 206,
    headers: {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(chunksize),
      'Content-Type': contentType,
    },
  });
}
