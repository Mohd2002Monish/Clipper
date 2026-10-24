import { connectMongo } from '../db';
import { YouTubeVideoAnalytics } from '../../models/YouTubeVideoAnalytics';
import { InstagramPost, IInstagramPostDocument } from '../../models/InstagramPost';
import { ThreadsPost, IThreadsPostDocument } from '../../models/ThreadsPost';
import { logger } from '../logger/logger';

export interface HourlyHeatmapSlot {
  hour: number;
  label: string; // e.g. "09:00 AM"
  totalImpressions: number;
  totalEngagement: number; // likes + comments + replies + saves
  avgViews: number;
  engagementScore: number; // 0 - 100
  isGoldenHour: boolean;
  audienceContext: string;
}

export interface RescheduleProposal {
  postId: string;
  platform: 'threads' | 'instagram';
  username: string;
  previewText: string;
  currentScheduleAt: Date;
  proposedScheduleAt: Date;
  reason: string;
  engagementLiftEstimate: string;
  status: 'proposed' | 'applied';
}

export interface AutoRescheduleSummary {
  totalScheduledInspected: number;
  proposalsCount: number;
  conflictsResolved: number;
  deadSlotsShifted: number;
  proposals: RescheduleProposal[];
  goldenHours: number[];
}

export class AutoRescheduleService {
  // Strategy Golden Slots (Matches audience prime hours: 9 AM, 2 PM, 9 PM, 11 PM, 1 AM)
  private readonly DEFAULT_GOLDEN_HOURS = [9, 14, 21, 23, 1];

  /**
   * Aggregates 24-hour performance distribution across YouTube, Instagram, and Threads.
   */
  public async getCrossPlatformAnalyticsOverview(): Promise<{
    heatmap: HourlyHeatmapSlot[];
    goldenHours: number[];
    queueHealth: {
      totalScheduled: number;
      subOptimalSlotsCount: number;
      slotClashesCount: number;
      evergreenWinnersCount: number;
    };
  }> {
    await connectMongo();

    const hourlyStats: Record<number, { count: number; views: number; engagement: number }> = {};
    for (let h = 0; h < 24; h++) {
      hourlyStats[h] = { count: 0, views: 0, engagement: 0 };
    }

    // 1. YouTube Video Analytics
    try {
      const ytAnalytics = await YouTubeVideoAnalytics.find().select('uploadHour views likes comments').lean();
      for (const yt of ytAnalytics) {
        const h = yt.uploadHour >= 0 && yt.uploadHour < 24 ? yt.uploadHour : 12;
        hourlyStats[h].count += 1;
        hourlyStats[h].views += yt.views || 0;
        hourlyStats[h].engagement += (yt.likes || 0) + (yt.comments || 0);
      }
    } catch {
      // Safe fallback
    }

    // 2. Instagram Posts Analytics
    try {
      const igPosts = await InstagramPost.find({ status: 'published', publishedAt: { $exists: true } })
        .select('publishedAt analytics')
        .lean();
      for (const ig of igPosts) {
        if (ig.publishedAt) {
          const h = new Date(ig.publishedAt).getHours();
          const views = ig.analytics?.views || ig.analytics?.plays || 0;
          const eng = (ig.analytics?.likes || 0) + (ig.analytics?.comments || 0) + (ig.analytics?.saves || 0);
          hourlyStats[h].count += 1;
          hourlyStats[h].views += views;
          hourlyStats[h].engagement += eng;
        }
      }
    } catch {
      // Safe fallback
    }

    // 3. Threads Posts Analytics
    try {
      const thPosts = await ThreadsPost.find({ status: 'published', publishedAt: { $exists: true } })
        .select('publishedAt analytics')
        .lean();
      for (const th of thPosts) {
        if (th.publishedAt) {
          const h = new Date(th.publishedAt).getHours();
          const views = th.analytics?.views || 0;
          const eng = (th.analytics?.likes || 0) + (th.analytics?.replies || 0) + (th.analytics?.reposts || 0);
          hourlyStats[h].count += 1;
          hourlyStats[h].views += views;
          hourlyStats[h].engagement += eng;
        }
      }
    } catch {
      // Safe fallback
    }

    // Calculate max engagement for score normalization
    let maxMetric = 1;
    for (let h = 0; h < 24; h++) {
      const metric = hourlyStats[h].views + hourlyStats[h].engagement * 3;
      if (metric > maxMetric) maxMetric = metric;
    }

    const contextLabels: Record<number, string> = {
      0: 'Midnight scrolling',
      1: 'Night Owl International peak',
      2: 'Late night quiet',
      3: 'Dead zone',
      4: 'Dead zone',
      5: 'Early dawn',
      6: 'Early commute',
      7: 'Morning wake-up',
      8: 'Commute & breakfast',
      9: 'Morning Golden Slot (Bollywood / Regional)',
      10: 'Mid-morning focus',
      11: 'Pre-lunch check-in',
      12: 'Lunch hour prime',
      13: 'Post-lunch slowdown',
      14: 'Afternoon Golden Slot (Indian Feed)',
      15: 'Afternoon coffee break',
      16: 'End of work wind-down',
      17: 'Evening commute',
      18: 'Early evening peak',
      19: 'Dinner & evening prime',
      20: 'Family prime time',
      21: 'Prime Golden Slot (Hollywood & Deep-dive)',
      22: 'Late evening wind-down',
      23: 'Late Night Golden Slot (Global Feed)',
    };

    const heatmap: HourlyHeatmapSlot[] = [];
    const goldenSet = new Set(this.DEFAULT_GOLDEN_HOURS);

    for (let h = 0; h < 24; h++) {
      const stat = hourlyStats[h];
      const metric = stat.views + stat.engagement * 3;
      // Calculate normalized score (blend between actual metrics and strategy baseline)
      const dataScore = Math.min(100, Math.round((metric / maxMetric) * 100));
      const isStrategic = goldenSet.has(h);
      const score = Math.max(isStrategic ? 75 : 10, dataScore);

      const period = h >= 12 ? 'PM' : 'AM';
      const displayHour = h % 12 === 0 ? 12 : h % 12;
      const label = `${displayHour.toString().padStart(2, '0')}:00 ${period}`;

      heatmap.push({
        hour: h,
        label,
        totalImpressions: stat.views,
        totalEngagement: stat.engagement,
        avgViews: stat.count > 0 ? Math.round(stat.views / stat.count) : 0,
        engagementScore: score,
        isGoldenHour: isStrategic || score >= 80,
        audienceContext: contextLabels[h] || 'General browsing',
      });
    }

    // Inspect upcoming scheduled queue health
    const now = new Date();
    const scheduledTh = await ThreadsPost.find({ status: 'scheduled', scheduleAt: { $gte: now } }).select('scheduleAt');
    const scheduledIg = await InstagramPost.find({ status: 'scheduled', scheduleAt: { $gte: now } }).select('scheduleAt');

    let subOptimalCount = 0;
    const hourFrequency: Record<number, number> = {};

    for (const post of [...scheduledTh, ...scheduledIg]) {
      if (post.scheduleAt) {
        const h = new Date(post.scheduleAt).getHours();
        hourFrequency[h] = (hourFrequency[h] || 0) + 1;
        const slot = heatmap.find((s) => s.hour === h);
        if (slot && slot.engagementScore < 50) {
          subOptimalCount++;
        }
      }
    }

    let clashesCount = 0;
    for (const count of Object.values(hourFrequency)) {
      if (count > 1) clashesCount += count - 1;
    }

    // Find evergreen winners count (posts with high likes or comments)
    const viralIg = await InstagramPost.countDocuments({
      status: 'published',
      $or: [{ 'analytics.likes': { $gte: 50 } }, { 'analytics.saves': { $gte: 15 } }],
    });
    const viralTh = await ThreadsPost.countDocuments({
      status: 'published',
      $or: [{ 'analytics.likes': { $gte: 25 } }, { 'analytics.replies': { $gte: 10 } }],
    });

    return {
      heatmap,
      goldenHours: this.DEFAULT_GOLDEN_HOURS,
      queueHealth: {
        totalScheduled: scheduledTh.length + scheduledIg.length,
        subOptimalSlotsCount: subOptimalCount,
        slotClashesCount: clashesCount,
        evergreenWinnersCount: viralIg + viralTh,
      },
    };
  };

  /**
   * Analyzes upcoming scheduled posts and proposals/reschedules them to hit Peak Golden Slots with jitter.
   */
  public async runAutoRescheduleLoop(options: {
    dryRun?: boolean;
    platforms?: ('threads' | 'instagram')[];
    jitterMinutes?: number;
  }): Promise<AutoRescheduleSummary> {
    await connectMongo();

    const dryRun = options.dryRun ?? false;
    const targetPlatforms = options.platforms || ['threads', 'instagram'];
    const jitterRange = options.jitterMinutes ?? 10;

    const proposals: RescheduleProposal[] = [];
    const now = new Date();

    const goldenHours = this.DEFAULT_GOLDEN_HOURS; // [9, 14, 21, 23, 1]
    let deadSlotsShifted = 0;
    let conflictsResolved = 0;

    // Helper: Find next golden slot with humanized jitter
    const getNextGoldenSlot = (fromDate: Date, usedSlots: Set<string>): Date => {
      const candidate = new Date(fromDate);
      let dayOffset = 0;

      while (dayOffset < 7) {
        for (const gh of goldenHours) {
          const testDate = new Date(candidate);
          testDate.setDate(testDate.getDate() + dayOffset);
          testDate.setHours(gh, 0, 0, 0);

          // Apply natural humanized jitter (-jitterRange to +jitterRange minutes)
          const jitter = Math.floor(Math.random() * (jitterRange * 2 + 1)) - jitterRange;
          testDate.setMinutes(testDate.getMinutes() + jitter);

          // Check if slot is in the future
          if (testDate.getTime() > now.getTime() + 15 * 60 * 1000) {
            const slotKey = `${testDate.getFullYear()}-${testDate.getMonth()}-${testDate.getDate()}-${testDate.getHours()}`;
            if (!usedSlots.has(slotKey)) {
              usedSlots.add(slotKey);
              return testDate;
            }
          }
        }
        dayOffset++;
      }

      return new Date(fromDate.getTime() + 2 * 60 * 60 * 1000);
    };

    const usedSlots = new Set<string>();

    // 1. Process Threads Scheduled Posts
    if (targetPlatforms.includes('threads')) {
      const scheduledThreads = await ThreadsPost.find({
        status: 'scheduled',
        scheduleAt: { $gte: now },
      }).sort({ scheduleAt: 1 });

      for (const post of scheduledThreads) {
        if (!post.scheduleAt) continue;
        const currentDt = new Date(post.scheduleAt);
        const currentHour = currentDt.getHours();

        const isGolden = goldenHours.includes(currentHour);
        const slotKey = `${currentDt.getFullYear()}-${currentDt.getMonth()}-${currentDt.getDate()}-${currentHour}`;
        const isClashing = usedSlots.has(slotKey);

        if (!isGolden || isClashing) {
          const newDt = getNextGoldenSlot(currentDt, usedSlots);
          const reason = !isGolden
            ? `Shifted from low-traffic hour (${currentDt.getHours()}:00) to Golden Prime Slot (${newDt.getHours()}:${newDt.getMinutes().toString().padStart(2, '0')})`
            : `Resolved same-hour slot clash by shifting to next optimal Golden Slot`;

          if (!isGolden) deadSlotsShifted++;
          if (isClashing) conflictsResolved++;

          if (!dryRun) {
            post.scheduleAt = newDt;
            await post.save();
          }

          proposals.push({
            postId: post._id.toString(),
            platform: 'threads',
            username: post.username,
            previewText: post.posts[0]?.text?.substring(0, 75) || 'Threads Post',
            currentScheduleAt: currentDt,
            proposedScheduleAt: newDt,
            reason,
            engagementLiftEstimate: '+35% to +60% views & replies',
            status: dryRun ? 'proposed' : 'applied',
          });
        } else {
          usedSlots.add(slotKey);
        }
      }
    }

    // 2. Process Instagram Scheduled Posts
    if (targetPlatforms.includes('instagram')) {
      const scheduledInstagram = await InstagramPost.find({
        status: 'scheduled',
        scheduleAt: { $gte: now },
      }).sort({ scheduleAt: 1 });

      for (const post of scheduledInstagram) {
        if (!post.scheduleAt) continue;
        const currentDt = new Date(post.scheduleAt);
        const currentHour = currentDt.getHours();

        const isGolden = goldenHours.includes(currentHour);
        const slotKey = `ig-${currentDt.getFullYear()}-${currentDt.getMonth()}-${currentDt.getDate()}-${currentHour}`;
        const isClashing = usedSlots.has(slotKey);

        if (!isGolden || isClashing) {
          const newDt = getNextGoldenSlot(currentDt, usedSlots);
          const reason = !isGolden
            ? `Shifted from sub-optimal hour to Peak Reels Golden Slot (${newDt.getHours()}:${newDt.getMinutes().toString().padStart(2, '0')})`
            : `Resolved queue crowding by spacing into next Golden Slot`;

          if (!isGolden) deadSlotsShifted++;
          if (isClashing) conflictsResolved++;

          if (!dryRun) {
            post.scheduleAt = newDt;
            await post.save();
          }

          proposals.push({
            postId: post._id.toString(),
            platform: 'instagram',
            username: post.username,
            previewText: post.caption?.substring(0, 75) || 'Instagram Reel',
            currentScheduleAt: currentDt,
            proposedScheduleAt: newDt,
            reason,
            engagementLiftEstimate: '+40% to +85% reach & saves',
            status: dryRun ? 'proposed' : 'applied',
          });
        } else {
          usedSlots.add(slotKey);
        }
      }
    }

    logger.system(
      'info',
      'AUTO_RESCHEDULE_COMPLETED',
      `Auto-reschedule loop completed (${dryRun ? 'DRY-RUN' : 'APPLIED'}): ${proposals.length} slots optimized, ${deadSlotsShifted} dead slots shifted, ${conflictsResolved} conflicts resolved.`
    );

    return {
      totalScheduledInspected: proposals.length,
      proposalsCount: proposals.length,
      conflictsResolved,
      deadSlotsShifted,
      proposals,
      goldenHours,
    };
  }

  /**
   * Fetches top performing evergreen winner posts suitable for re-syndication or quote-reposting.
   */
  public async getEvergreenViralCandidates(limit = 10): Promise<
    Array<{
      id: string;
      platform: 'threads' | 'instagram';
      username: string;
      titleOrHook: string;
      publishedAt: Date;
      views: number;
      engagement: number;
      metricSummary: string;
    }>
  > {
    await connectMongo();

    const results: Array<{
      id: string;
      platform: 'threads' | 'instagram';
      username: string;
      titleOrHook: string;
      publishedAt: Date;
      views: number;
      engagement: number;
      metricSummary: string;
    }> = [];

    // 1. Threads Top Posts
    const thWinners = await ThreadsPost.find({ status: 'published' })
      .sort({ 'analytics.views': -1, 'analytics.likes': -1 })
      .limit(limit)
      .lean();

    for (const th of thWinners) {
      const views = th.analytics?.views || 0;
      const eng = (th.analytics?.likes || 0) + (th.analytics?.replies || 0) + (th.analytics?.reposts || 0);
      if (views > 0 || eng > 0) {
        results.push({
          id: th._id.toString(),
          platform: 'threads',
          username: th.username,
          titleOrHook: th.posts[0]?.text?.substring(0, 100) || 'Threads Post',
          publishedAt: th.publishedAt ? new Date(th.publishedAt) : new Date(),
          views,
          engagement: eng,
          metricSummary: `${views.toLocaleString()} views &bull; ${th.analytics?.likes || 0} likes &bull; ${th.analytics?.replies || 0} replies`,
        });
      }
    }

    // 2. Instagram Top Reels
    const igWinners = await InstagramPost.find({ status: 'published' })
      .sort({ 'analytics.reach': -1, 'analytics.likes': -1 })
      .limit(limit)
      .lean();

    for (const ig of igWinners) {
      const views = ig.analytics?.views || ig.analytics?.plays || ig.analytics?.reach || 0;
      const eng = (ig.analytics?.likes || 0) + (ig.analytics?.comments || 0) + (ig.analytics?.saves || 0);
      if (views > 0 || eng > 0) {
        results.push({
          id: ig._id.toString(),
          platform: 'instagram',
          username: ig.username,
          titleOrHook: ig.caption?.substring(0, 100) || 'Instagram Reel',
          publishedAt: ig.publishedAt ? new Date(ig.publishedAt) : new Date(),
          views,
          engagement: eng,
          metricSummary: `${views.toLocaleString()} views &bull; ${ig.analytics?.likes || 0} likes &bull; ${ig.analytics?.saves || 0} saves`,
        });
      }
    }

    return results.sort((a, b) => b.engagement - a.engagement).slice(0, limit);
  }

  /**
   * Recycles an evergreen viral post into a new scheduled post during a future Golden Slot.
   */
  public async recycleViralPost(
    platform: 'threads' | 'instagram',
    postId: string,
    targetDate?: Date
  ): Promise<{ success: boolean; newPostId?: string; scheduledAt: Date }> {
    await connectMongo();

    const scheduleDt = targetDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days later
    // Align to 21:00 (prime evening slot) + jitter
    scheduleDt.setHours(21, Math.floor(Math.random() * 20) - 10, 0, 0);

    if (platform === 'threads') {
      const original = await ThreadsPost.findById(postId);
      if (!original) throw new Error(`Threads post ${postId} not found.`);

      const recycledText = original.posts[0]?.text || '';
      const newPost = await ThreadsPost.create({
        accountId: original.accountId,
        username: original.username,
        posts: [
          {
            text: recycledText,
            mediaUrl: original.posts[0]?.mediaUrl,
            mediaType: original.posts[0]?.mediaType,
          },
        ],
        status: 'scheduled',
        scheduleAt: scheduleDt,
        followUp: original.followUp?.text
          ? {
              enabled: true,
              text: original.followUp.text,
              delayMinutes: 5,
              status: 'pending',
            }
          : undefined,
      });

      return { success: true, newPostId: newPost._id.toString(), scheduledAt: scheduleDt };
    } else {
      const original = await InstagramPost.findById(postId);
      if (!original) throw new Error(`Instagram post ${postId} not found.`);

      const newPost = await InstagramPost.create({
        accountId: original.accountId,
        username: original.username,
        caption: original.caption,
        mediaType: original.mediaType,
        mediaUrl: original.mediaUrl,
        coverUrl: original.coverUrl,
        shareToFeed: original.shareToFeed,
        status: 'scheduled',
        scheduleAt: scheduleDt,
      });

      return { success: true, newPostId: newPost._id.toString(), scheduledAt: scheduleDt };
    }
  }
}

export const autoRescheduleService = new AutoRescheduleService();
