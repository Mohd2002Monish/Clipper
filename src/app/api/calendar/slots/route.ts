import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { ThreadsPost } from '@/models/ThreadsPost';
import { InstagramPost } from '@/models/InstagramPost';
import { FacebookPost } from '@/models/FacebookPost';
import { YouTubeUpload } from '@/models/YouTubeUpload';

export const dynamic = 'force-dynamic';

export interface CalendarPostEvent {
  id: string;
  platform: 'youtube' | 'instagram' | 'threads' | 'facebook';
  status: 'scheduled' | 'published';
  time: string;
  titleOrText: string;
  usernameOrChannel: string;
  mediaUrl?: string;
  permalink?: string;
}

export async function GET(req: NextRequest) {
  try {
    await connectMongo();
    const { searchParams } = new URL(req.url);
    const startDateStr = searchParams.get('start');
    const endDateStr = searchParams.get('end');

    const start = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDateStr ? new Date(endDateStr) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const [threadsPosts, igPosts, fbPosts, ytUploads] = await Promise.all([
      ThreadsPost.find({
        $or: [
          { status: 'scheduled', scheduleAt: { $gte: start, $lte: end } },
          { status: 'published', publishedAt: { $gte: start, $lte: end } },
        ],
      }),
      InstagramPost.find({
        $or: [
          { status: 'scheduled', scheduleAt: { $gte: start, $lte: end } },
          { status: 'published', publishedAt: { $gte: start, $lte: end } },
        ],
      }),
      FacebookPost.find({
        $or: [
          { status: 'scheduled', scheduleAt: { $gte: start, $lte: end } },
          { status: 'published', publishedAt: { $gte: start, $lte: end } },
        ],
      }),
      YouTubeUpload.find({
        createdAt: { $gte: start, $lte: end },
      }),
    ]);

    const events: CalendarPostEvent[] = [];

    // Map Threads
    threadsPosts.forEach((p) => {
      const dt = p.status === 'scheduled' ? p.scheduleAt : p.publishedAt;
      if (dt) {
        events.push({
          id: p._id.toString(),
          platform: 'threads',
          status: p.status as any,
          time: dt.toISOString(),
          titleOrText: p.posts?.[0]?.text || 'Threads post',
          usernameOrChannel: `@${p.username}`,
          permalink: p.threadsPermalink,
        });
      }
    });

    // Map Instagram
    igPosts.forEach((p) => {
      const dt = p.status === 'scheduled' ? p.scheduleAt : p.publishedAt;
      if (dt) {
        events.push({
          id: p._id.toString(),
          platform: 'instagram',
          status: p.status as any,
          time: dt.toISOString(),
          titleOrText: p.caption || 'Instagram Reel',
          usernameOrChannel: `@${p.username}`,
          permalink: p.instagramPermalink,
        });
      }
    });

    // Map Facebook
    fbPosts.forEach((p) => {
      const dt = p.status === 'scheduled' ? p.scheduleAt : p.publishedAt;
      if (dt) {
        events.push({
          id: p._id.toString(),
          platform: 'facebook',
          status: p.status as any,
          time: dt.toISOString(),
          titleOrText: p.title || p.message || 'Facebook Video',
          usernameOrChannel: p.pageName,
          permalink: p.facebookPermalink,
        });
      }
    });

    // Map YouTube
    ytUploads.forEach((p) => {
      events.push({
        id: p._id.toString(),
        platform: 'youtube',
        status: p.status === 'completed' ? 'published' : 'scheduled',
        time: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
        titleOrText: p.title || p.partFilename || 'YouTube Video',
        usernameOrChannel: p.channelTitle || p.channelId || 'YouTube Shorts',
        permalink: p.youtubeUrl,
      });
    });

    // Sort chronologically
    events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    // Golden Slot schedule guidelines (5 slots daily)
    const goldenSlots = [
      { hour: 9, label: '09:00 AM', niche: 'Indian / Bollywood' },
      { hour: 14, label: '02:00 PM', niche: 'Indian / Bollywood' },
      { hour: 21, label: '09:00 PM', niche: 'Hollywood / International' },
      { hour: 23, label: '11:00 PM', niche: 'Hollywood / International' },
      { hour: 1, label: '01:00 AM', niche: 'Hollywood / International' },
    ];

    return NextResponse.json({
      success: true,
      events,
      totalEvents: events.length,
      goldenSlots,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
