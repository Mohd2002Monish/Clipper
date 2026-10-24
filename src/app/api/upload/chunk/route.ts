import { NextRequest, NextResponse } from 'next/server';
import { chunkManager } from '@/lib/uploader/chunkManager';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const uploadId = formData.get('uploadId') as string;
    const chunkIndexStr = formData.get('chunkIndex') as string;
    const chunkFile = formData.get('chunk') as Blob;

    if (!uploadId || chunkIndexStr === null || !chunkFile) {
      return NextResponse.json(
        { error: 'Missing uploadId, chunkIndex, or chunk payload.' },
        { status: 400 }
      );
    }

    const chunkIndex = parseInt(chunkIndexStr, 10);
    const arrayBuffer = await chunkFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = chunkManager.saveChunk(uploadId, chunkIndex, buffer);

    return NextResponse.json({
      success: true,
      chunkIndex,
      receivedChunks: result.receivedChunks,
      isComplete: result.isComplete,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
