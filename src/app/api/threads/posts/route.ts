import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { ThreadsPost } from '@/models/ThreadsPost';
import { threadsService } from '@/lib/services/threadsService';
import { threadsAutomationService } from '@/lib/services/threadsAutomationService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectMongo();
    // Run background check for any scheduled posts that reached time
    threadsAutomationService.runScheduledPublishCycle().catch(() => {});

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const filter: Record<string, unknown> = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (search) {
      filter['posts.text'] = { $regex: search, $options: 'i' };
    }

    const posts = await ThreadsPost.find(filter)
      .sort({ scheduleAt: 1, createdAt: -1 })
      .limit(limit);

    // Also get counts by status for tabs
    const counts = {
      all: await ThreadsPost.countDocuments(),
      scheduled: await ThreadsPost.countDocuments({ status: 'scheduled' }),
      published: await ThreadsPost.countDocuments({ status: 'published' }),
      draft: await ThreadsPost.countDocuments({ status: 'draft' }),
      failed: await ThreadsPost.countDocuments({ status: 'failed' }),
    };

    return NextResponse.json({ success: true, posts, counts });
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
      posts,
      scheduleAt,
      publishNow,
      autoRepost,
      followUp,
      videoSource,
    } = body;

    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one post is required' }, { status: 400 });
    }

    if (!accountId && !username) {
      return NextResponse.json(
        { success: false, error: 'A connected Threads account is required to create or schedule posts' },
        { status: 400 }
      );
    }

    const targetAccount = accountId;
    const targetUsername = (username || '').replace(/^@/, '');

    let initialStatus: 'draft' | 'scheduled' | 'publishing' = 'draft';
    let targetScheduleDate: Date | undefined = undefined;

    if (publishNow) {
      initialStatus = 'publishing';
    } else if (scheduleAt) {
      targetScheduleDate = new Date(scheduleAt);
      if (isNaN(targetScheduleDate.getTime())) {
        return NextResponse.json({ success: false, error: 'Invalid schedule date/time' }, { status: 400 });
      }
      initialStatus = 'scheduled';
    }

    const newPost = await ThreadsPost.create({
      accountId: targetAccount,
      username: targetUsername,
      posts,
      status: initialStatus,
      scheduleAt: targetScheduleDate,
      autoRepost: autoRepost || { enabled: false, delaysHours: [168, 336] },
      followUp: followUp || { enabled: false, text: '', delayMinutes: 0 },
      videoSource: videoSource || { sourceType: 'none' },
    });

    // If instant publish was requested, trigger publishing immediately
    if (publishNow) {
      const pubResult = await threadsService.publishPost(newPost._id.toString());
      const updated = await ThreadsPost.findById(newPost._id);
      return NextResponse.json({ success: true, post: updated, publishResult: pubResult });
    }

    return NextResponse.json({ success: true, post: newPost });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
