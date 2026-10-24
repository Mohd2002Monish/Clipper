import { NextRequest, NextResponse } from 'next/server';
import { autoRescheduleService } from '@/lib/services/autoRescheduleService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const analytics = await autoRescheduleService.getCrossPlatformAnalyticsOverview();
    const viralWinners = await autoRescheduleService.getEvergreenViralCandidates(10);

    return NextResponse.json({
      success: true,
      heatmap: analytics.heatmap,
      goldenHours: analytics.goldenHours,
      queueHealth: analytics.queueHealth,
      viralWinners,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun ?? false;
    const platforms = body.platforms || ['threads', 'instagram'];
    const jitterMinutes = body.jitterMinutes ?? 10;

    const result = await autoRescheduleService.runAutoRescheduleLoop({
      dryRun,
      platforms,
      jitterMinutes,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, postId, targetDate } = body;

    if (!platform || !postId) {
      return NextResponse.json({ success: false, error: 'platform and postId are required.' }, { status: 400 });
    }

    const result = await autoRescheduleService.recycleViralPost(
      platform,
      postId,
      targetDate ? new Date(targetDate) : undefined
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
