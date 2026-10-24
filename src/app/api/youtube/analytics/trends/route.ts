import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { YouTubeUpload } from '@/models/YouTubeUpload';
import { YouTubeVideoAnalytics } from '@/models/YouTubeVideoAnalytics';

export const dynamic = 'force-dynamic';

interface BucketItem {
  key: string;
  label: string;
  subLabel?: string;
  views: number;
  likes: number;
  comments: number;
  videoCount: number;
}

export async function GET(req: NextRequest) {
  try {
    await connectMongo();
    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get('timeframe') || 'daily'; // 'daily' | 'weekly' | 'monthly'
    const channelId = searchParams.get('channelId');

    const filter: Record<string, any> = {};
    if (channelId && channelId !== 'all') {
      filter.channelId = channelId;
    }

    const uploads = await YouTubeUpload.find(filter).sort({ publishedAt: -1, createdAt: -1 }).lean();
    const analytics = await YouTubeVideoAnalytics.find(filter).lean();
    const analyticsMap = new Map(analytics.map((a) => [a.videoId, a]));

    const now = new Date();
    const buckets: BucketItem[] = [];

    if (timeframe === 'daily') {
      // Last 14 days
      const daysCount = 14;
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });

        buckets.push({
          key: dateStr,
          label: dayLabel,
          subLabel: weekday,
          views: 0,
          likes: 0,
          comments: 0,
          videoCount: 0,
        });
      }

      const bucketMap = new Map(buckets.map((b) => [b.key, b]));

      for (const u of uploads) {
        const dateObj = u.publishedAt ? new Date(u.publishedAt) : new Date(u.createdAt || now);
        const dateKey = dateObj.toISOString().split('T')[0];
        const a = u.videoId ? analyticsMap.get(u.videoId) : null;
        const views = u.views ?? a?.views ?? 0;
        const likes = u.likes ?? a?.likes ?? 0;
        const comments = u.comments ?? a?.comments ?? 0;

        const bucket = bucketMap.get(dateKey);
        if (bucket) {
          bucket.views += views;
          bucket.likes += likes;
          bucket.comments += comments;
          bucket.videoCount += 1;
        }
      }
    } else if (timeframe === 'weekly') {
      // Last 8 weeks
      const weeksCount = 8;
      for (let i = weeksCount - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        // Start of week (Sunday)
        const dayOfWeek = d.getDay();
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - dayOfWeek);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const key = startOfWeek.toISOString().split('T')[0];
        const label = `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

        buckets.push({
          key,
          label: `Wk ${weeksCount - i}`,
          subLabel: label,
          views: 0,
          likes: 0,
          comments: 0,
          videoCount: 0,
        });
      }

      for (const u of uploads) {
        const dateObj = u.publishedAt ? new Date(u.publishedAt) : new Date(u.createdAt || now);
        const a = u.videoId ? analyticsMap.get(u.videoId) : null;
        const views = u.views ?? a?.views ?? 0;
        const likes = u.likes ?? a?.likes ?? 0;
        const comments = u.comments ?? a?.comments ?? 0;

        // Find which week bucket this belongs to
        const diffDays = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
        const weekIndex = Math.floor(diffDays / 7);
        const bucketIndex = buckets.length - 1 - weekIndex;

        if (bucketIndex >= 0 && bucketIndex < buckets.length) {
          buckets[bucketIndex].views += views;
          buckets[bucketIndex].likes += likes;
          buckets[bucketIndex].comments += comments;
          buckets[bucketIndex].videoCount += 1;
        }
      }
    } else {
      // Monthly: Last 6 months
      const monthsCount = 6;
      for (let i = monthsCount - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        buckets.push({
          key,
          label,
          subLabel: `${d.getFullYear()}`,
          views: 0,
          likes: 0,
          comments: 0,
          videoCount: 0,
        });
      }

      const bucketMap = new Map(buckets.map((b) => [b.key, b]));

      for (const u of uploads) {
        const dateObj = u.publishedAt ? new Date(u.publishedAt) : new Date(u.createdAt || now);
        const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        const a = u.videoId ? analyticsMap.get(u.videoId) : null;
        const views = u.views ?? a?.views ?? 0;
        const likes = u.likes ?? a?.likes ?? 0;
        const comments = u.comments ?? a?.comments ?? 0;

        const bucket = bucketMap.get(key);
        if (bucket) {
          bucket.views += views;
          bucket.likes += likes;
          bucket.comments += comments;
          bucket.videoCount += 1;
        }
      }
    }

    // Compute peak bucket and totals
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalVideos = uploads.length;
    let peakBucket: BucketItem = buckets[0] || { key: '', label: '', views: 0, likes: 0, comments: 0, videoCount: 0 };

    for (const b of buckets) {
      totalViews += b.views;
      totalLikes += b.likes;
      totalComments += b.comments;
      if (b.views > peakBucket.views) {
        peakBucket = b;
      }
    }

    const avgViews = buckets.length > 0 ? Math.round(totalViews / buckets.length) : 0;

    // Top 5 videos
    const enrichedVideos = uploads.map((u) => {
      const a = u.videoId ? analyticsMap.get(u.videoId) : null;
      const views = u.views ?? a?.views ?? 0;
      const likes = u.likes ?? a?.likes ?? 0;
      const comments = u.comments ?? a?.comments ?? 0;
      return {
        _id: u._id,
        videoId: u.videoId,
        title: u.title,
        channelTitle: u.channelTitle,
        views,
        likes,
        comments,
        youtubeUrl: u.youtubeUrl,
        publishedAt: u.publishedAt || u.createdAt,
      };
    });

    enrichedVideos.sort((a, b) => b.views - a.views);
    const topVideos = enrichedVideos.slice(0, 5);

    return NextResponse.json({
      success: true,
      timeframe,
      buckets,
      summary: {
        totalViews,
        totalLikes,
        totalComments,
        totalVideos,
        avgViews,
        peakBucketLabel: peakBucket.label,
        peakBucketViews: peakBucket.views,
      },
      topVideos,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
