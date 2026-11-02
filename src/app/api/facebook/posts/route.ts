import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { FacebookPost } from '@/models/FacebookPost';
import { facebookService } from '@/lib/services/facebookService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectMongo();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const accountId = searchParams.get('accountId') || searchParams.get('pageId');

    const filter: Record<string, unknown> = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (accountId && accountId !== 'all') {
      filter.$or = [{ accountId }, { pageId: accountId }];
    }

    if (search) {
      filter.$or = [
        { message: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { pageName: { $regex: search, $options: 'i' } },
      ];
    }

    const posts = await FacebookPost.find(filter).sort({ scheduleAt: -1, createdAt: -1 });

    const draftCount = await FacebookPost.countDocuments({ status: 'draft' });
    const scheduledCount = await FacebookPost.countDocuments({ status: 'scheduled' });
    const publishedCount = await FacebookPost.countDocuments({ status: 'published' });
    const failedCount = await FacebookPost.countDocuments({ status: 'failed' });

    return NextResponse.json({
      success: true,
      posts,
      counts: {
        all: draftCount + scheduledCount + publishedCount + failedCount,
        draft: draftCount,
        scheduled: scheduledCount,
        published: publishedCount,
        failed: failedCount,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectMongo();
    const body = await req.json();

    const {
      accountId,
      pageId,
      pageName,
      message,
      title,
      postType = 'REEL',
      mediaUrl,
      status = 'draft',
      scheduleAt,
      firstComment,
      autoRepost,
      videoSource,
    } = body;

    if (!pageId && !accountId) {
      return NextResponse.json(
        { success: false, error: 'pageId or accountId is required' },
        { status: 400 }
      );
    }

    const newPost = await FacebookPost.create({
      accountId: accountId || pageId,
      pageId: pageId || accountId,
      pageName: pageName || 'Facebook Page',
      message: message || '',
      title: title || '',
      postType,
      mediaUrl: mediaUrl || '',
      status,
      scheduleAt: scheduleAt ? new Date(scheduleAt) : undefined,
      firstComment,
      autoRepost,
      videoSource,
    });

    if (status === 'publishing' || status === 'published') {
      const publishRes = await facebookService.publishPost(newPost._id.toString());
      return NextResponse.json({
        success: publishRes.success,
        post: await FacebookPost.findById(newPost._id),
        permalink: publishRes.permalink,
        error: publishRes.error,
      });
    }

    return NextResponse.json({ success: true, post: newPost });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

