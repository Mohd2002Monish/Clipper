import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { WorkerHeartbeat } from '@/models/WorkerHeartbeat';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectMongo();
    const heartbeat = await WorkerHeartbeat.findOne({ workerName: 'Mac-Worker' });

    if (!heartbeat) {
      return NextResponse.json({
        success: true,
        isOnline: false,
        message: 'No Mac worker heartbeat registered yet.',
      });
    }

    const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(heartbeat.lastPingAt).getTime()) / 1000));
    // Online if pinged within the last 90 seconds
    const isOnline = heartbeat.isRunning && diffSeconds <= 90;

    return NextResponse.json({
      success: true,
      isOnline,
      isRunning: heartbeat.isRunning,
      activeIngests: heartbeat.activeIngests || 0,
      lastPingAt: heartbeat.lastPingAt,
      secondsAgo: diffSeconds,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    await connectMongo();

    const workerName = body.workerName || 'Mac-Worker';
    const isRunning = body.isRunning !== false;
    const activeIngests = typeof body.activeIngests === 'number' ? body.activeIngests : 0;

    const record = await WorkerHeartbeat.findOneAndUpdate(
      { workerName },
      {
        workerName,
        isRunning,
        activeIngests,
        lastPingAt: new Date(),
        metadata: body.metadata || {},
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      record,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

