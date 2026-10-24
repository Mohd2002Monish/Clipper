import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { InstagramPost } from '@/models/InstagramPost';
import { instagramService } from '@/lib/services/instagramService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectMongo();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const accountId = searchParams.get('accountId');

    const filter: Record<string, unknown> = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (accountId && accountId !== 'all') {
      filter.accountId = accountId;
    }

    if (search) {
      filter.$or = [
        { caption: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    const posts = await InstagramPost.find(filter).sort({ scheduleAt: -1, createdAt: -1 });

    const draftCount = await InstagramPost.countDocuments({ status: 'draft' });
    const scheduledCount = await InstagramPost.countDocuments({ status: 'scheduled' });
    const publishedCount = await InstagramPost.countDocuments({ status: 'published' });
    const failedCount = await InstagramPost.countDocuments({ status: 'failed' });

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
      username,
      caption,
      mediaType = 'REELS',
      mediaUrl,
      coverUrl,
      shareToFeed = true,
      status = 'draft',
      scheduleAt,
      firstComment,
      autoRepost,
      videoSource,
    } = body;

    if (!accountId || !username) {
      return NextResponse.json(
        { success: false, error: 'accountId and username are required' },
        { status: 400 }
      );
    }

    const newPost = await InstagramPost.create({
      accountId,
      username: username.replace(/^@/, ''),
      caption: caption || '',
      mediaType,
      mediaUrl: mediaUrl || '',
      coverUrl: coverUrl || '',
      shareToFeed,
      status,
      scheduleAt: scheduleAt ? new Date(scheduleAt) : undefined,
      firstComment,
      autoRepost,
      videoSource,
    });

    // If publishing immediately
    if (status === 'publishing' || status === 'published') {
      const publishRes = await instagramService.publishPost(newPost._id.toString());
      return NextResponse.json({
        success: publishRes.success,
        post: await InstagramPost.findById(newPost._id),
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
