import { NextRequest, NextResponse } from 'next/server';
import { chunkManager } from '@/lib/uploader/chunkManager';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const uploadId = req.nextUrl.searchParams.get('uploadId');
  if (!uploadId) {
    return NextResponse.json({ error: 'Missing uploadId parameter.' }, { status: 400 });
  }

  const session = chunkManager.getSession(uploadId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found or expired.' }, { status: 404 });
  }

  return NextResponse.json({
    uploadId: session.uploadId,
    originalFilename: session.originalFilename,
    totalSize: session.totalSize,
    chunkSize: session.chunkSize,
    totalChunks: session.totalChunks,
    receivedChunks: session.receivedChunks,
    isComplete: session.receivedChunks.length === session.totalChunks,
  });
}
