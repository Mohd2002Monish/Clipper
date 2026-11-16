import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { VideoScoutSchedule } from '@/models/VideoScoutSchedule';
import { aiVideoScoutService } from '@/lib/services/aiVideoScoutService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectMongo();
    const schedules = await VideoScoutSchedule.find().sort({ createdAt: -1 });
    return NextResponse.json({ success: true, schedules });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await connectMongo();

    const name = body.name?.trim() || 'Daily Video Scout';
    const prompt = body.prompt?.trim();
    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'A prompt or instruction is required.' },
        { status: 400 }
      );
    }

    const targetFolder = body.targetFolder?.trim() || 'Shorts';
    const dailyCount = Math.max(1, Math.min(25, parseInt(body.dailyCount, 10) || 5));
    const scheduleType = body.scheduleType || 'daily';
    const cronHour = parseInt(body.cronHour, 10) || 9;
    const cronMinute = parseInt(body.cronMinute, 10) || 0;
    const intervalHours = parseInt(body.intervalHours, 10) || 24;
    const autoCaption = body.autoCaption !== false;
    const captionStyle = body.captionStyle || 'viral_yellow';
    const autoSplit = body.autoSplit !== false;
    const partDurationSeconds = parseInt(body.partDurationSeconds, 10) || 60;

    // Generate initial smart search keywords if not provided
    let searchKeywords: string[] = Array.isArray(body.searchKeywords) ? body.searchKeywords : [];
    if (searchKeywords.length === 0) {
      const parsed = await aiVideoScoutService.parseUserPrompt(prompt, targetFolder);
      searchKeywords = parsed.searchQueries;
    }

    // Compute next run time
    const nextRun = new Date();
    if (scheduleType === 'daily') {
      nextRun.setHours(cronHour, cronMinute, 0, 0);
      if (nextRun.getTime() <= Date.now()) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
    } else {
      nextRun.setHours(nextRun.getHours() + intervalHours);
    }

    const schedule = await VideoScoutSchedule.create({
      name,
      prompt,
      searchKeywords,
      targetFolder,
      dailyCount,
      scheduleType,
      cronHour,
      cronMinute,
      intervalHours,
      isActive: true,
      autoCaption,
      captionStyle,
      reframeMode: '9:16',
      autoSplit,
      partDurationSeconds,
      seenVideoIds: [],
      totalIngestedCount: 0,
      nextRunAt: nextRun,
    });

    return NextResponse.json({ success: true, schedule }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
