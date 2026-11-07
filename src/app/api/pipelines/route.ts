import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { OmniPipeline } from '@/models/OmniPipeline';
import { omniPipelineService } from '@/lib/services/omniPipelineService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectMongo();

    const [pipelines, accounts, folders] = await Promise.all([
      OmniPipeline.find({}).sort({ updatedAt: -1 }),
      omniPipelineService.getAccountsSummary(),
      omniPipelineService.getAvailableFolders(),
    ]);

    return NextResponse.json({
      success: true,
      pipelines,
      accounts,
      folders,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectMongo();
    const body = await req.json();

    const {
      name,
      folderName,
      folderId = 'root',
      targets,
      captions,
      thumbnails,
      schedule,
    } = body;

    if (!name || !folderName) {
      return NextResponse.json({ success: false, error: 'Pipeline Name and Folder Name are required.' }, { status: 400 });
    }

    const hasAnyTarget =
      targets &&
      (targets.youtube?.enabled ||
        targets.instagram?.enabled ||
        targets.facebook?.enabled ||
        targets.threads?.enabled);

    if (!hasAnyTarget) {
      return NextResponse.json(
        { success: false, error: 'Please select at least one target channel (YouTube, Instagram, Facebook, or Threads).' },
        { status: 400 }
      );
    }

    const nextRun = omniPipelineService.computeNextSlot(schedule || { mode: 'golden_slots', goldenSlots: [9, 14, 21, 23, 1], intervalHours: 4 });

    const pipeline = await OmniPipeline.create({
      name,
      folderName,
      folderId,
      targets,
      captions: {
        mode: captions?.mode || 'unified',
        template: captions?.template || '{{title}}\n\nFollow for more curated cinema moments.\n\n{{hashtags}}',
        hashtags: captions?.hashtags || ['#Shorts', '#Cinema', '#MovieVault', '#Bollywood', '#FilmLovers'],
        enableVaultCta: captions?.enableVaultCta ?? true,
        customOverrides: captions?.customOverrides || {},
      },
      thumbnails: {
        mode: thumbnails?.mode || 'auto_frame',
        frameTimestampSeconds: thumbnails?.frameTimestampSeconds || 1.0,
        customThumbnailUrl: thumbnails?.customThumbnailUrl,
        individualMode: thumbnails?.individualMode ?? false,
        channelOverrides: thumbnails?.channelOverrides || {},
      },
      schedule: {
        mode: schedule?.mode || 'golden_slots',
        goldenSlots: schedule?.goldenSlots || [9, 14, 21, 23, 1],
        intervalHours: schedule?.intervalHours || 4,
        dailyLimit: schedule?.dailyLimit || 5,
        nextRunSlot: nextRun,
      },
      stats: {
        totalVideosProcessed: 0,
        totalPostsCreated: 0,
        postedVideoIds: [],
      },
      status: 'active',
    });

    return NextResponse.json({
      success: true,
      message: 'Multi-Channel Pipeline created successfully.',
      pipeline,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

