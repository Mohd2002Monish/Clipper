import { NextRequest, NextResponse } from 'next/server';
import { workerProcessManager } from '@/lib/services/workerProcessManager';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = workerProcessManager.isRunning();
    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'start';

    if (action === 'start') {
      const result = workerProcessManager.start();
      const status = workerProcessManager.isRunning();
      return NextResponse.json({
        ...result,
        ...status,
      });
    }

    if (action === 'stop') {
      const result = workerProcessManager.stop();
      return NextResponse.json({
        ...result,
        isRunning: false,
      });
    }

    if (action === 'restart') {
      workerProcessManager.stop();
      await new Promise((r) => setTimeout(r, 600));
      const result = workerProcessManager.start();
      const status = workerProcessManager.isRunning();
      return NextResponse.json({
        ...result,
        ...status,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action. Use start, stop, or restart.' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

