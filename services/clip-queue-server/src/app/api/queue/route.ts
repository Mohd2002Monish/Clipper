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
    await connectMongo();

    // 1. Support Batch Submissions: { items: [{ url, folderName, notes, tags }] }
    if (Array.isArray(body.items) && body.items.length > 0) {
      const createdItems = [];
      const skippedItems = [];

      for (const entry of body.items) {
        const rawUrl = entry.url;
        if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) continue;

        const { cleanUrl, platform } = parseAndCleanUrl(rawUrl);

        const existingPending = await ClipQueue.findOne({
          cleanUrl,
          status: { $in: ['pending', 'processing', 'downloading'] },
        });

        if (existingPending) {
          skippedItems.push(cleanUrl);
          continue;
        }

        const targetFolder = {
          folderId: entry.folderId || body.folderId || 'root',
          folderName: entry.folderName || body.folderName || 'General',
          parentPath: entry.parentPath || '',
        };

        const contentMeta = {
          title: entry.title || '',
          author: entry.author || '',
          description: entry.description || '',
          tags: Array.isArray(entry.tags) ? entry.tags : [],
          notes: entry.notes || body.notes || '',
        };

        const processingDirectives = {
          autoSplit: !!(entry.autoSplit ?? body.autoSplit),
          partDurationSeconds: entry.partDurationSeconds || body.partDurationSeconds || 60,
          reframeMode: entry.reframeMode || body.reframeMode || 'blur',
          targetAspectRatio: entry.targetAspectRatio || (platform === 'youtube_shorts' || platform === 'instagram_reel' ? '9:16' : '16:9'),
          autoCaption: !!(entry.autoCaption ?? body.autoCaption),
          autoPublishCampaignId: entry.autoPublishCampaignId || '',
        };

        const queueItem = await ClipQueue.create({
          url: rawUrl.trim(),
          cleanUrl,
          platform,
          status: 'pending',
          targetFolder,
          contentMeta,
          processingDirectives,
          devicePushToken: entry.devicePushToken || body.devicePushToken || '',
          executionMeta: {
            attempts: 0,
            maxAttempts: 3,
            sourceClient: {
              type: body.sourceClient || 'mobile_batch',
              deviceInfo: body.deviceInfo || req.headers.get('user-agent') || 'Mobile Device',
              appVersion: body.appVersion || '1.1.0',
            },
          },
        });

        createdItems.push(queueItem);
      }

      return NextResponse.json({
        success: true,
        batch: true,
        addedCount: createdItems.length,
        skippedCount: skippedItems.length,
        items: createdItems,
      }, { status: 201 });
    }

    // 2. Single Item Submission
    const rawUrl = body.url;

    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
      return NextResponse.json({ success: false, error: 'A valid video URL is required.' }, { status: 400 });
    }

    const { cleanUrl, platform } = parseAndCleanUrl(rawUrl);

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
      appVersion: body.appVersion || '1.1.0',
    };

    const queueItem = await ClipQueue.create({
      url: rawUrl.trim(),
      cleanUrl,
      platform,
      status: 'pending',
      targetFolder,
      contentMeta,
      processingDirectives,
      devicePushToken: body.devicePushToken || '',
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

