import { NextRequest, NextResponse } from 'next/server';
import { threadsAutomationService } from '@/lib/services/threadsAutomationService';
import { instagramAutomationService } from '@/lib/services/instagramAutomationService';
import { autoRescheduleService } from '@/lib/services/autoRescheduleService';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleCronCycle();
}

export async function POST() {
  return handleCronCycle();
}

async function handleCronCycle() {
  try {
    logger.system('info', 'SYNDICATION_CRON_TRIGGERED', 'Running Unified Cross-Platform Syndication & Scheduling Cycle');

    // 1. Dispatch due Threads posts & sync metrics
    const threadsPublish = await threadsAutomationService.runScheduledPublishCycle();
    const threadsMetricsSynced = await threadsAutomationService.syncRecentMetrics();

    // 2. Dispatch due Instagram Reels
    const instagramPublish = await instagramAutomationService.runScheduledPublishCycle();

    // 3. Run subtle queue conflict resolution
    const rescheduleSweep = await autoRescheduleService.runAutoRescheduleLoop({
      dryRun: false,
      jitterMinutes: 8,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      threads: {
        published: threadsPublish.published,
        failed: threadsPublish.failed,
        metricsSynced: threadsMetricsSynced,
      },
      instagram: {
        published: instagramPublish.published,
        failed: instagramPublish.failed,
      },
      autoReschedule: {
        slotsShifted: rescheduleSweep.deadSlotsShifted,
        conflictsResolved: rescheduleSweep.conflictsResolved,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.system('error', 'SYNDICATION_CRON_FAILED', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
