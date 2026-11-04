import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { ClipQueue } from '@/models/ClipQueue';
import { parseAndCleanUrl } from '@/lib/urlParser';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectMongo();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);

    const query: Record<string, any> = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const total = await ClipQueue.countDocuments(query);
    const items = await ClipQueue.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      items,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUrl = body.url;

    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
      return NextResponse.json({ success: false, error: 'A valid video URL is required.' }, { status: 400 });
    }

    const { cleanUrl, platform } = parseAndCleanUrl(rawUrl);

    await connectMongo();

    // Check for identical pending entry to prevent accidental double-submits
    const existingPending = await ClipQueue.findOne({
      cleanUrl,
      status: { $in: ['pending', 'processing', 'downloading'] },
    });

    if (existingPending) {
      return NextResponse.json({
        success: true,
        alreadyQueued: true,
        message: 'This clip is already in queue and awaiting processing.',
        item: existingPending,
      });
    }

    const targetFolder = {
      folderId: body.folderId || body.targetFolder?.folderId || 'root',
      folderName: body.folderName || body.targetFolder?.folderName || 'General',
      parentPath: body.parentPath || body.targetFolder?.parentPath || '',
    };

    const contentMeta = {
      title: body.title || '',
      author: body.author || '',
      description: body.description || '',
      tags: Array.isArray(body.tags) ? body.tags : [],
      notes: body.notes || '',
    };

    const processingDirectives = {
      autoSplit: !!body.autoSplit,
      partDurationSeconds: body.partDurationSeconds || 60,
      reframeMode: body.reframeMode || 'blur',
      targetAspectRatio: body.targetAspectRatio || (platform === 'youtube_shorts' || platform === 'instagram_reel' ? '9:16' : '16:9'),
      autoCaption: !!body.autoCaption,
      autoPublishCampaignId: body.autoPublishCampaignId || '',
    };

    const sourceClient = {
      type: body.sourceClient || 'mobile_share',
      deviceInfo: body.deviceInfo || req.headers.get('user-agent') || 'Mobile Device',
      appVersion: body.appVersion || '1.0.0',
    };

    const queueItem = await ClipQueue.create({
      url: rawUrl.trim(),
      cleanUrl,
      platform,
      status: 'pending',
      targetFolder,
      contentMeta,
      processingDirectives,
      executionMeta: {
        attempts: 0,
        maxAttempts: 3,
        sourceClient,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Clip successfully added to download queue.',
      item: queueItem,
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

