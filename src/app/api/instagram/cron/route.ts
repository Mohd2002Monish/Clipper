import { NextResponse } from 'next/server';
import { instagramAutomationService } from '@/lib/services/instagramAutomationService';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleCron();
}

export async function POST() {
  return handleCron();
}

async function handleCron() {
  try {
    logger.system('info', 'INSTAGRAM_CRON_TRIGGERED', 'Running Instagram scheduled Reel publish cycle');
    const result = await instagramAutomationService.runScheduledPublishCycle();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      published: result.published,
      failed: result.failed,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.system('error', 'INSTAGRAM_CRON_FAILED', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
