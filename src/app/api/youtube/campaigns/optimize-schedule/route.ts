import { NextRequest, NextResponse } from 'next/server';
import { youtubeAutomationService } from '@/lib/services/youtubeAutomationService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { campaignId } = body;

    if (!campaignId) {
      return NextResponse.json({ success: false, error: 'campaignId is required' }, { status: 400 });
    }

    const result = await youtubeAutomationService.runWeeklyAiOptimization(campaignId);

    return NextResponse.json({
      success: true,
      message: 'Weekly schedule successfully optimized by Google Gemini AI!',
      newSchedule: result.newSchedule,
      rationale: result.rationale,
      summary: result.summary,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
