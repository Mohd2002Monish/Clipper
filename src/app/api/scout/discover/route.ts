import { NextRequest, NextResponse } from 'next/server';
import { aiVideoScoutService } from '@/lib/services/aiVideoScoutService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = body.prompt?.trim();
    const folderOverride = body.folderOverride?.trim();
    const autoIngest = Boolean(body.autoIngest);

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'A search prompt or instruction is required.' },
        { status: 400 }
      );
    }

    const scoutResult = await aiVideoScoutService.executeInstantScout(prompt, folderOverride);

    if (autoIngest && scoutResult.selectedVideos.length > 0) {
      const ingestResult = await aiVideoScoutService.ingestWinningVideos(
        scoutResult.selectedVideos,
        scoutResult.intent
      );
      scoutResult.queuedCount = ingestResult.queuedCount;
    }

    return NextResponse.json({
      success: true,
      result: scoutResult,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
