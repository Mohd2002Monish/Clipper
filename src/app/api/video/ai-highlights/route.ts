import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { config } from '@/lib/config';
import { probeService } from '@/lib/services/probeService';
import { aiHighlightService } from '@/lib/services/aiHighlightService';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const AIHighlightsRequestSchema = z.object({
  sourceFilename: z.string().min(1),
  maxClips: z.number().int().min(1).max(20).default(5),
  targetDuration: z.number().int().min(15).max(180).default(50),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = AIHighlightsRequestSchema.parse(body);

    const videoPath =
      fs.existsSync(validated.sourceFilename)
        ? validated.sourceFilename
        : path.isAbsolute(validated.sourceFilename)
        ? validated.sourceFilename
        : path.join(config.uploadsDir, validated.sourceFilename);
    if (!fs.existsSync(videoPath)) {
      return NextResponse.json({ error: 'Source video file not found.' }, { status: 404 });
    }

    const probe = await probeService.probeVideo(videoPath);
    if (!probe || probe.duration <= 0) {
      return NextResponse.json({ error: 'Unable to probe video or invalid duration.' }, { status: 400 });
    }

    const result = await aiHighlightService.detectViralHighlights({
      videoPath,
      sourceDuration: probe.duration,
      maxClips: validated.maxClips,
      targetClipDurationSec: validated.targetDuration,
    });

    return NextResponse.json({
      success: true,
      ...result,
      sourceDuration: probe.duration,
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: err.errors }, { status: 400 });
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
