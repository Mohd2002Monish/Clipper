import { NextRequest, NextResponse } from 'next/server';
import { youtubeAutomationService } from '@/lib/services/youtubeAutomationService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await youtubeAutomationService.runDailyAnalyticsSync(body.campaignId);
    return NextResponse.json({
      success: true,
      result,
      message: `Analytics synchronized for ${result.updatedCount} videos!`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
