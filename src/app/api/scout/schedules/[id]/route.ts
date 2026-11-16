import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { VideoScoutSchedule } from '@/models/VideoScoutSchedule';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectMongo();
    const schedule = await VideoScoutSchedule.findById(params.id);
    if (!schedule) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, schedule });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    await connectMongo();

    const schedule = await VideoScoutSchedule.findById(params.id);
    if (!schedule) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
    }

    if (body.name !== undefined) schedule.name = body.name.trim();
    if (body.prompt !== undefined) schedule.prompt = body.prompt.trim();
    if (body.targetFolder !== undefined) schedule.targetFolder = body.targetFolder.trim();
    if (body.dailyCount !== undefined) schedule.dailyCount = Math.max(1, Math.min(25, parseInt(body.dailyCount, 10)));
    if (body.scheduleType !== undefined) schedule.scheduleType = body.scheduleType;
    if (body.cronHour !== undefined) schedule.cronHour = parseInt(body.cronHour, 10);
    if (body.cronMinute !== undefined) schedule.cronMinute = parseInt(body.cronMinute, 10);
    if (body.intervalHours !== undefined) schedule.intervalHours = parseInt(body.intervalHours, 10);
    if (body.isActive !== undefined) schedule.isActive = Boolean(body.isActive);
    if (body.autoCaption !== undefined) schedule.autoCaption = Boolean(body.autoCaption);
    if (body.captionStyle !== undefined) schedule.captionStyle = body.captionStyle;
    if (body.autoSplit !== undefined) schedule.autoSplit = Boolean(body.autoSplit);
    if (body.partDurationSeconds !== undefined) schedule.partDurationSeconds = parseInt(body.partDurationSeconds, 10);
    if (Array.isArray(body.searchKeywords)) schedule.searchKeywords = body.searchKeywords;

    await schedule.save();
    return NextResponse.json({ success: true, schedule });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectMongo();
    const result = await VideoScoutSchedule.findByIdAndDelete(params.id);
    if (!result) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Schedule deleted successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
