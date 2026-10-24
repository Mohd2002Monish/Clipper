import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { YouTubeUpload } from '@/models/YouTubeUpload';
import { YouTubeVideoAnalytics } from '@/models/YouTubeVideoAnalytics';
import { youtubeAutomationService } from '@/lib/services/youtubeAutomationService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectMongo();
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const channelId = searchParams.get('channelId');
    const folder = searchParams.get('folder');
    const videoType = searchParams.get('videoType');
    const search = searchParams.get('search');
    const sync = searchParams.get('sync') === 'true';

    // If live sync is requested, fetch latest view/like counts directly from YouTube API
    if (sync) {
      try {
        await youtubeAutomationService.runDailyAnalyticsSync();
      } catch {
        // Non-fatal if quota exceeded or offline
      }
    }

    const filter: Record<string, any> = {};
    if (channelId && channelId !== 'all') filter.channelId = channelId;
    if (folder && folder !== 'all') filter.folderName = folder;
    if (videoType && videoType !== 'all') filter.videoType = videoType;
    if (search && search.trim()) {
      filter.title = { $regex: new RegExp(search.trim(), 'i') };
    }

    const uploads = await YouTubeUpload.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Map analytics by videoId to ensure views are always populated
    const videoIds = uploads.map((u) => u.videoId).filter(Boolean);
    const analyticsRecords = await YouTubeVideoAnalytics.find({
      videoId: { $in: videoIds },
    }).lean();

    const analyticsMap = new Map(analyticsRecords.map((a) => [a.videoId, a]));

    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;

    const enrichedHistory = uploads.map((item) => {
      const analytics = item.videoId ? analyticsMap.get(item.videoId) : null;
      const views = item.views ?? analytics?.views ?? 0;
      const likes = item.likes ?? analytics?.likes ?? 0;
      const comments = item.comments ?? analytics?.comments ?? 0;
      const lastCheckedAt = item.lastCheckedAt || analytics?.lastCheckedAt || null;

      totalViews += views;
      totalLikes += likes;
      totalComments += comments;

      return {
        ...item,
        views,
        likes,
        comments,
        lastCheckedAt,
      };
    });

    return NextResponse.json({
      success: true,
      history: enrichedHistory,
      count: enrichedHistory.length,
      stats: {
        totalVideos: enrichedHistory.length,
        totalViews,
        totalLikes,
        totalComments,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
