import { NextRequest, NextResponse } from 'next/server';
import { chunkManager } from '@/lib/uploader/chunkManager';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uploadId } = body;

    if (!uploadId) {
      return NextResponse.json({ error: 'Missing uploadId parameter.' }, { status: 400 });
    }

    const aborted = chunkManager.abortSession(uploadId);
    return NextResponse.json({ success: aborted });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
