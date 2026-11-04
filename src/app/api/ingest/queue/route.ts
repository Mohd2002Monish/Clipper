import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { ClipQueue } from '@/models/ClipQueue';
import { clipIngestionService } from '@/lib/services/clipIngestionService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectMongo();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    const query: Record<string, any> = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const items = await ClipQueue.find(query).sort({ createdAt: -1 }).limit(limit);
    const pendingCount = await ClipQueue.countDocuments({ status: 'pending' });
    const completedCount = await ClipQueue.countDocuments({ status: 'completed' });
    const failedCount = await ClipQueue.countDocuments({ status: 'failed' });

    return NextResponse.json({
      success: true,
      counts: {
        all: items.length,
        pending: pendingCount,
        completed: completedCount,
        failed: failedCount,
      },
      items,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'process_pending';

    if (action === 'process_pending') {
      // Process pending queue asynchronously without blocking HTTP response
      clipIngestionService.processPendingQueue().catch(() => {});
      return NextResponse.json({
        success: true,
        message: 'Started processing pending clips in background.',
      });
    }

    if (action === 'sync_folders') {
      const count = await clipIngestionService.syncFoldersToRegistry();
      return NextResponse.json({
        success: true,
        message: `Synced ${count} folders to cloud registry.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

