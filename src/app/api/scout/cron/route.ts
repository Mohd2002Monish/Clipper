import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { VideoScoutSchedule } from '@/models/VideoScoutSchedule';
import { aiVideoScoutService } from '@/lib/services/aiVideoScoutService';
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
    await connectMongo();
    const now = new Date();

    const dueSchedules = await VideoScoutSchedule.find({
      isActive: true,
      $or: [
        { nextRunAt: { $lte: now } },
        { nextRunAt: { $exists: false } },
      ],
    }).limit(5);

    if (dueSchedules.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No due scout schedules found.',
        processed: 0,
      });
    }

    const results = [];
    for (const schedule of dueSchedules) {
      try {
        logger.system('info', 'SCOUT_CRON_TRIGGER', `Running due schedule "${schedule.name}" (${schedule._id})`);
        const res = await aiVideoScoutService.runScheduledTask(schedule._id.toString());
        results.push({ id: schedule._id, name: schedule.name, status: 'success', queued: res.queuedCount });
      } catch (runErr: unknown) {
        const msg = runErr instanceof Error ? runErr.message : String(runErr);
        logger.system('error', 'SCOUT_CRON_ERROR', `Failed schedule "${schedule.name}": ${msg}`);
        results.push({ id: schedule._id, name: schedule.name, status: 'failed', error: msg });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
