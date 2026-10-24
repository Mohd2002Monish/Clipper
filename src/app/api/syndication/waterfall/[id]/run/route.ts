import { NextRequest, NextResponse } from 'next/server';
import { waterfallService } from '@/lib/services/waterfallService';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const result = await waterfallService.triggerWaterfallRun(id, {
      videoTitle: body.videoTitle,
      sourceFilename: body.sourceFilename,
      folderName: body.folderName || 'General',
      sourceType: body.sourceType,
      localPath: body.localPath,
      driveFileId: body.driveFileId,
      jobId: body.jobId,
      partIndex: body.partIndex,
      anchorDate: body.anchorDate ? new Date(body.anchorDate) : undefined,
      customYoutubeTitle: body.customYoutubeTitle,
      customInstagramCaption: body.customInstagramCaption,
      customThreadsHook: body.customThreadsHook,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
