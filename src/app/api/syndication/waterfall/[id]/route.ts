import { NextRequest, NextResponse } from 'next/server';
import { waterfallService } from '@/lib/services/waterfallService';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const pipeline = await waterfallService.getPipeline(id);
    if (!pipeline) {
      return NextResponse.json({ success: false, error: 'Pipeline not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, pipeline });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const updated = await waterfallService.updatePipeline(id, body);
    return NextResponse.json({ success: true, pipeline: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const success = await waterfallService.deletePipeline(id);
    return NextResponse.json({ success });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
