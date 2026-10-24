import { NextRequest, NextResponse } from 'next/server';
import { threadsAutomationService } from '@/lib/services/threadsAutomationService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const publishResult = await threadsAutomationService.runScheduledPublishCycle();
    const metricsSynced = await threadsAutomationService.syncRecentMetrics();
    return NextResponse.json({
      success: true,
      published: publishResult.published,
      failed: publishResult.failed,
      metricsSynced,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
