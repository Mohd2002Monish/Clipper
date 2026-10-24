import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { YouTubeVideoAnalytics } from '@/models/YouTubeVideoAnalytics';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectMongo();
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId');

    const query: Record<string, any> = {};
    if (campaignId) query.campaignId = campaignId;

    const analytics = await YouTubeVideoAnalytics.find(query).sort({ uploadDate: -1 }).lean();

    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;

    const hourlyStats: Record<number, { count: number; totalViews: number; totalLikes: number; avgViews: number }> = {};
    for (let h = 0; h < 24; h++) {
      hourlyStats[h] = { count: 0, totalViews: 0, totalLikes: 0, avgViews: 0 };
    }

    for (const item of analytics) {
      totalViews += item.views || 0;
      totalLikes += item.likes || 0;
      totalComments += item.comments || 0;

      const h = item.uploadHour ?? 12;
      if (hourlyStats[h]) {
        hourlyStats[h].count += 1;
        hourlyStats[h].totalViews += item.views || 0;
        hourlyStats[h].totalLikes += item.likes || 0;
      }
    }

    let bestHour = 18;
    let maxAvgViews = -1;
    for (let h = 0; h < 24; h++) {
      if (hourlyStats[h].count > 0) {
        hourlyStats[h].avgViews = Math.round(hourlyStats[h].totalViews / hourlyStats[h].count);
        if (hourlyStats[h].avgViews > maxAvgViews) {
          maxAvgViews = hourlyStats[h].avgViews;
          bestHour = h;
        }
      }
    }

    return NextResponse.json({
      success: true,
      totalVideos: analytics.length,
      totalViews,
      totalLikes,
      totalComments,
      bestPerformingHour: bestHour,
      hourlyStats,
      videos: analytics.slice(0, 50),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
