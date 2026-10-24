import { NextRequest, NextResponse } from 'next/server';
import { waterfallService } from '@/lib/services/waterfallService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const folderName = searchParams.get('folderName') || undefined;

    const pipelines = await waterfallService.getPipelines();
    const availableVideos = await waterfallService.getAvailableVideos(folderName);

    return NextResponse.json({
      success: true,
      pipelines,
      availableVideos,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pipeline = await waterfallService.createPipeline(body);
    return NextResponse.json({ success: true, pipeline });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
