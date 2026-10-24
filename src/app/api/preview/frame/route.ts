import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { config } from '@/lib/config';
import { calculateTargetDimensions } from '@/lib/renderer/dimensions';
import { buildRenderRecipe } from '@/lib/renderer/filterBuilder';
import { probeService } from '@/lib/services/probeService';
import { autoCropService } from '@/lib/renderer/autoCropService';

const execFileAsync = promisify(execFile);

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sourceFilename,
      aspectRatio = '9:16',
      reframeMode = 'blur',
      backgroundColor = '#000000',
      focalPoint = 'center',
      timestamp = 1.0,
    } = body;

    if (!sourceFilename) {
      return NextResponse.json({ error: 'Missing sourceFilename parameter.' }, { status: 400 });
    }

    const videoPath =
      fs.existsSync(sourceFilename)
        ? sourceFilename
        : path.isAbsolute(sourceFilename)
        ? sourceFilename
        : path.join(config.uploadsDir, sourceFilename);
    if (!fs.existsSync(videoPath)) {
      return NextResponse.json({ error: 'Source video file not found.' }, { status: 404 });
    }

    // 1. Probe source facts
    const probe = await probeService.probeVideo(videoPath);

    // 2. Target dimensions (scaled down for fast thumbnail preview: e.g. 540x960)
    const fullDimensions = calculateTargetDimensions({
      aspectRatio,
      resolution: '720p',
      sourceWidth: probe.displayWidth,
      sourceHeight: probe.displayHeight,
    });

    // 3. Auto-Face Crop calculation for still preview
    let dynamicCropExpr: string | undefined = undefined;
    if (reframeMode === 'crop' && focalPoint === 'auto_face') {
      try {
        const normX = await autoCropService.detectFrameSubjectCentroid(
          videoPath,
          Math.min(timestamp, probe.duration > 1 ? 1 : 0)
        );
        const scaleFactor = Math.max(
          fullDimensions.width / probe.displayWidth,
          fullDimensions.height / probe.displayHeight
        );
        const inW = Math.round(probe.displayWidth * scaleFactor);
        const maxOffset = inW - fullDimensions.width;
        const cropX = Math.max(0, Math.min(maxOffset, Math.round(normX * inW - fullDimensions.width / 2)));
        dynamicCropExpr = String(cropX);
      } catch {
        // Fallback to center
      }
    }

    // 4. Build render recipe
    const recipe = buildRenderRecipe({
      inputPath: videoPath,
      outputPath: 'pipe:1',
      start: Math.min(timestamp, probe.duration > 1 ? 1 : 0),
      duration: 1,
      targetDimensions: fullDimensions,
      reframeMode,
      backgroundColor,
      focalPoint,
      probe,
      dynamicCropExpr,
    });

    // Extract single still frame
    const stillArgs = [
      '-y',
      '-ss',
      String(Math.min(timestamp, probe.duration > 1 ? 1 : 0)),
      '-i',
      videoPath,
      '-filter_complex',
      recipe.filterGraph,
      '-map',
      '[vout]',
      '-vframes',
      '1',
      '-f',
      'image2',
      '-q:v',
      '3',
      'pipe:1',
    ];

    const { stdout } = await execFileAsync(config.ffmpegPath, stillArgs, {
      encoding: 'buffer',
      maxBuffer: 5 * 1024 * 1024,
    });

    return new NextResponse(stdout, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
