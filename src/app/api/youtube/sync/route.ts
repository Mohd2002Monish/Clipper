import { NextRequest, NextResponse } from 'next/server';
import { youtubeAutomationService } from '@/lib/services/youtubeAutomationService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const channelId = body.channelId || undefined;

    const result = await youtubeAutomationService.syncChannelUploadedVideos(channelId);

    return NextResponse.json({
      success: true,
      message: `Synchronized ${result.syncedVideos} videos for channel ${result.channelTitle || 'Active Channel'}!`,
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
