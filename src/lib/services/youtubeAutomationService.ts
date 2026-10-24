import { connectMongo } from '../db';
import { YouTubeCampaign, IYouTubeCampaignDocument } from '../../models/YouTubeCampaign';
import { YouTubeVideoAnalytics } from '../../models/YouTubeVideoAnalytics';
import { YouTubeUpload } from '../../models/YouTubeUpload';
import { youtubeService } from './youtubeService';
import { driveService } from './driveService';
import { config } from '../config';
import { logger } from '../logger/logger';

export interface CampaignSummary {
  campaign: IYouTubeCampaignDocument;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  bestPerformingHour?: number;
  hourlyStats: Record<number, { count: number; views: number; avgViews: number }>;
}

export class YouTubeAutomationService {
  /**
   * Runs the hourly upload cycle:
   * 1. Resets daily counter if it's a new day.
   * 2. Checks if daily limit of 8 videos has been reached.
   * 3. Finds the next un-uploaded video from Drive folder.
   * 4. Uploads it and initializes analytics tracking.
   */
  public async runHourlyUploadCycle(): Promise<{ uploaded: number; skipped: number; errors: string[] }> {
    await connectMongo();

    const activeCampaigns = await YouTubeCampaign.find({ status: 'active' });
    let uploadedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const currentHour = new Date().getHours();

    for (const campaign of activeCampaigns) {
      try {
        // 1. Reset daily count on new day
        if (campaign.lastUploadDate !== todayStr) {
          campaign.uploadedTodayCount = 0;
          campaign.lastUploadDate = todayStr;
          await campaign.save();
        }

        // 2. Enforce strict daily limit (8 videos max)
        if (campaign.uploadedTodayCount >= campaign.dailyLimit) {
          logger.system(
            'info',
            'CAMPAIGN_DAILY_LIMIT_REACHED',
            `Campaign "${campaign.name}" reached daily limit of ${campaign.dailyLimit} videos. Will resume tomorrow.`
          );
          skippedCount++;
          continue;
        }

        // 3. Discover all videos in the campaign folder
        const allVideos = await this.fetchVideosForFolder(campaign.folderName);
        if (allVideos.length === 0) {
          logger.system('warn', 'CAMPAIGN_NO_VIDEOS', `No videos found in folder "${campaign.folderName}" for campaign "${campaign.name}"`);
          skippedCount++;
          continue;
        }

        // 4. Find all already uploaded videos (check both YouTubeUpload and analytics)
        const previousUploads = await YouTubeUpload.find({
          $or: [{ channelId: campaign.channelId }, { folderName: campaign.folderName }],
        })
          .select('sourceId partFilename title videoId')
          .lean();

        const uploadedSourceIds = new Set<string>();
        const uploadedNames = new Set<string>();

        for (const up of previousUploads) {
          if (up.sourceId) uploadedSourceIds.add(up.sourceId);
          if (up.partFilename) uploadedNames.add(up.partFilename.toLowerCase());
          if (up.title) uploadedNames.add(up.title.toLowerCase());
        }

        const analyticsRecords = await YouTubeVideoAnalytics.find({ campaignId: String(campaign._id) }).select('driveFileId videoTitle').lean();
        for (const an of analyticsRecords) {
          if (an.driveFileId) uploadedSourceIds.add(an.driveFileId);
          if (an.videoTitle) uploadedNames.add(an.videoTitle.toLowerCase());
        }

        // 5. Filter for next pending video
        const pendingVideos = allVideos.filter((v) => {
          if (v.driveFileId && uploadedSourceIds.has(v.driveFileId)) return false;
          if (v.localPath && uploadedSourceIds.has(v.localPath)) return false;
          if (uploadedNames.has(v.name.toLowerCase())) return false;
          return true;
        });

        if (pendingVideos.length === 0) {
          logger.system(
            'info',
            'CAMPAIGN_ALL_UPLOADED',
            `All videos in folder "${campaign.folderName}" have been published to YouTube for campaign "${campaign.name}".`
          );
          campaign.status = 'completed';
          await campaign.save();
          skippedCount++;
          continue;
        }

        // Pick the first video in sequence (e.g. part01, part02, etc.)
        const nextVideo = pendingVideos[0];

        logger.system(
          'info',
          'CAMPAIGN_UPLOADING_VIDEO',
          `Campaign "${campaign.name}" publishing video "${nextVideo.name}" (${campaign.uploadedTodayCount + 1}/${campaign.dailyLimit} today)`
        );

        // Upload using youtubeService
        const uploadResult = await youtubeService.uploadVideo({
          channelId: campaign.channelId,
          folderName: campaign.folderName,
          sourceType: nextVideo.sourceType,
          localPath: nextVideo.localPath,
          driveFileId: nextVideo.driveFileId,
          title: nextVideo.title,
          description: `Uploaded automatically via VideoTimmer Auto-Pilot Campaign "${campaign.name}".\n\n#Viral #Video`,
          privacyStatus: campaign.privacyStatus,
          videoType: campaign.videoType,
          partFilename: nextVideo.name,
          partIndex: nextVideo.partIndex,
        });

        const videoId = uploadResult.videoId;
        if (!videoId) {
          throw new Error('Upload completed but no videoId was returned.');
        }

        // Update campaign counters
        campaign.uploadedTodayCount += 1;
        campaign.totalUploaded += 1;
        campaign.lastUploadAt = new Date();
        campaign.lastUploadDate = todayStr;

        // Compute next scheduled slot
        const nextSlot = campaign.scheduleHours.find((h) => h > currentHour) || campaign.scheduleHours[0];
        campaign.nextScheduledSlot = `${nextSlot.toString().padStart(2, '0')}:00`;
        await campaign.save();

        // Record in VideoAnalytics collection
        await YouTubeVideoAnalytics.create({
          campaignId: String(campaign._id),
          channelId: campaign.channelId,
          videoId,
          videoTitle: uploadResult.title,
          folderName: campaign.folderName,
          driveFileId: nextVideo.driveFileId,
          uploadHour: currentHour,
          uploadDate: new Date(),
          views: 0,
          likes: 0,
          comments: 0,
          lastCheckedAt: new Date(),
          history: [{ checkedAt: new Date(), views: 0, likes: 0, comments: 0 }],
        });

        uploadedCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.system('error', 'CAMPAIGN_CYCLE_ERROR', `Error in campaign ${campaign.name}: ${msg}`);
        errors.push(`Campaign ${campaign.name}: ${msg}`);
      }
    }

    return { uploaded: uploadedCount, skipped: skippedCount, errors };
  }

  /**
   * Daily Analytics Retrieval:
   * Retrieves views, likes, comments for all campaign videos via YouTube Data API v3
   */
  public async runDailyAnalyticsSync(campaignId?: string): Promise<{ updatedCount: number; errors: string[] }> {
    await connectMongo();

    const query: Record<string, any> = {};
    if (campaignId) query.campaignId = campaignId;

    const records = await YouTubeVideoAnalytics.find(query);
    if (records.length === 0) {
      return { updatedCount: 0, errors: [] };
    }

    const byChannel = new Map<string, typeof records>();
    for (const r of records) {
      const list = byChannel.get(r.channelId) || [];
      list.push(r);
      byChannel.set(r.channelId, list);
    }

    let updatedCount = 0;
    const errors: string[] = [];

    for (const [channelId, videoRecords] of byChannel.entries()) {
      try {
        const youtube = await youtubeService.getYouTubeClientForChannel(channelId);

        // Batch in groups of 50
        const chunkSize = 50;
        for (let i = 0; i < videoRecords.length; i += chunkSize) {
          const chunk = videoRecords.slice(i, i + chunkSize);
          const videoIds = chunk.map((c) => c.videoId).filter(Boolean);

          const listRes = await youtube.videos.list({
            part: ['statistics', 'snippet'],
            id: videoIds,
          });

          const items = listRes.data.items || [];
          const statsMap = new Map(items.map((it) => [it.id!, it]));

          for (const rec of chunk) {
            const item = statsMap.get(rec.videoId);
            if (item && item.statistics) {
              const views = parseInt(item.statistics.viewCount || '0', 10);
              const likes = parseInt(item.statistics.likeCount || '0', 10);
              const comments = parseInt(item.statistics.commentCount || '0', 10);

              rec.views = views;
              rec.likes = likes;
              rec.comments = comments;
              rec.lastCheckedAt = new Date();
              rec.history.push({
                checkedAt: new Date(),
                views,
                likes,
                comments,
              });

              await rec.save();
              updatedCount++;
            }
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Channel ${channelId}: ${msg}`);
      }
    }

    // Mark campaigns with lastAnalyticsSyncAt
    if (campaignId) {
      await YouTubeCampaign.findByIdAndUpdate(campaignId, { lastAnalyticsSyncAt: new Date() });
    } else {
      await YouTubeCampaign.updateMany({ status: 'active' }, { lastAnalyticsSyncAt: new Date() });
    }

    return { updatedCount, errors };
  }

  /**
   * Weekly AI Smart Scheduling Optimization:
   * Aggregates 7-day retention/views data and asks Google Gemini AI
   * to compute the optimal 8 time slots for the daily schedule.
   */
  public async runWeeklyAiOptimization(campaignId: string): Promise<{
    newSchedule: number[];
    rationale: string;
    summary: string;
  }> {
    await connectMongo();

    const campaign = await YouTubeCampaign.findById(campaignId);
    if (!campaign) {
      throw new Error(`Campaign with ID ${campaignId} not found.`);
    }

    // 1. Gather all video analytics for this campaign
    const videos = await YouTubeVideoAnalytics.find({ campaignId }).lean();

    // Group by hour
    const hourlyData: Record<number, { count: number; totalViews: number; totalLikes: number; avgViews: number }> = {};
    for (let h = 0; h < 24; h++) {
      hourlyData[h] = { count: 0, totalViews: 0, totalLikes: 0, avgViews: 0 };
    }

    let totalViews = 0;
    for (const v of videos) {
      const h = v.uploadHour;
      if (hourlyData[h]) {
        hourlyData[h].count += 1;
        hourlyData[h].totalViews += v.views;
        hourlyData[h].totalLikes += v.likes;
        totalViews += v.views;
      }
    }

    for (let h = 0; h < 24; h++) {
      if (hourlyData[h].count > 0) {
        hourlyData[h].avgViews = Math.round(hourlyData[h].totalViews / hourlyData[h].count);
      }
    }

    // Find best performing hour
    let bestHour = 18;
    let maxAvgViews = -1;
    for (let h = 0; h < 24; h++) {
      if (hourlyData[h].avgViews > maxAvgViews && hourlyData[h].count > 0) {
        maxAvgViews = hourlyData[h].avgViews;
        bestHour = h;
      }
    }

    // 2. Call Google Gemini AI
    const apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    let newSchedule = [9, 11, 13, 15, 17, 19, 21, 23]; // Default balanced 8 slots
    let rationale = 'Initial balanced daytime & evening distribution.';
    let summary = `Analyzed ${videos.length} videos with ${totalViews.toLocaleString()} total views. Peak engagement detected at ${bestHour}:00.`;

    if (apiKey) {
      try {
        const prompt = `
You are a YouTube Algorithm & Audience Retention Strategist.
Analyze the following hourly performance data for an active YouTube channel that publishes exactly 8 videos per day:

Total Videos Analyzed: ${videos.length}
Total Views: ${totalViews}
Best Performing Hour So Far: ${bestHour}:00 (Average views: ${maxAvgViews})

Hourly Performance (Hour 0 to 23):
${Object.entries(hourlyData)
  .map(([h, d]) => `Hour ${h}:00 -> ${d.count} videos uploaded, ${d.totalViews} views, ${d.avgViews} avg views, ${d.totalLikes} likes`)
  .join('\n')}

Requirement:
1. Select exactly 8 distinct integer hours (between 0 and 23) in ascending order representing the absolute best times to upload daily videos to maximize viewer retention and initial velocity.
2. Explain why these 8 hours were chosen based on peak viewer habits (e.g. lunch breaks, after work, evening prime time, night owl periods).

Respond ONLY with valid JSON in this exact structure:
{
  "scheduleHours": [number, number, number, number, number, number, number, number],
  "bestPerformingHour": number,
  "summary": "Short 1-2 sentence summary of audience retention findings",
  "rationale": "Comprehensive explanation of the new 8-slot schedule"
}
`;

        const models = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];
        for (const model of models) {
          try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.3,
                },
              }),
            });

            if (res.ok) {
              const data = await res.json();
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                const parsed = JSON.parse(text);
                if (Array.isArray(parsed.scheduleHours) && parsed.scheduleHours.length === 8) {
                  newSchedule = parsed.scheduleHours.sort((a: number, b: number) => a - b);
                  rationale = parsed.rationale || rationale;
                  summary = parsed.summary || summary;
                  break;
                }
              }
            }
          } catch {
            // Try next model
          }
        }
      } catch (aiErr) {
        logger.system('warn', 'GEMINI_OPTIMIZATION_FAILED', `AI schedule optimization fallback used: ${aiErr}`);
      }
    }

    // 3. Update campaign record
    campaign.scheduleHours = newSchedule;
    campaign.aiScheduleRationale = rationale;
    campaign.aiPerformanceSummary = summary;
    campaign.lastAiOptimizationAt = new Date();
    await campaign.save();

    logger.system(
      'info',
      'CAMPAIGN_AI_OPTIMIZED',
      `Campaign "${campaign.name}" schedule optimized by AI: [${newSchedule.join(', ')}]`
    );

    return {
      newSchedule,
      rationale,
      summary,
    };
  }

  /**
   * Helper to fetch all videos in a folder (Drive & MongoDB)
   */
  private async fetchVideosForFolder(folderName: string) {
    // Re-use logic to find all videos in this folder
    const allVideos: Array<{
      id: string;
      name: string;
      title: string;
      duration: number;
      sourceType: 'drive' | 'local';
      driveFileId?: string;
      localPath?: string;
      partIndex?: number;
    }> = [];

    try {
      const drive = await driveService.getAuthenticatedDrive();
      if (drive) {
        const allFoldersRes = await drive.files.list({
          q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
          fields: 'files(id, name, parents)',
          pageSize: 150,
          spaces: 'drive',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });

        const allFolders = allFoldersRes.data.files || [];
        const normTarget = folderName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const targetFolderIds = new Set<string>();

        for (const f of allFolders) {
          if (!f.id || !f.name) continue;
          const normName = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normName === normTarget || normName.includes(normTarget) || normTarget.includes(normName)) {
            targetFolderIds.add(f.id);
          }
        }

        // Include subfolders
        let addedMore = true;
        while (addedMore) {
          addedMore = false;
          for (const f of allFolders) {
            if (f.id && !targetFolderIds.has(f.id) && f.parents) {
              if (f.parents.some((p: string) => targetFolderIds.has(p))) {
                targetFolderIds.add(f.id);
                addedMore = true;
              }
            }
          }
        }

        const folderIdsArray = Array.from(targetFolderIds);
        if (folderIdsArray.length > 0) {
          const parentFilter = folderIdsArray.slice(0, 15).map((id) => `'${id}' in parents`).join(' or ');
          const q = `trashed = false and (${parentFilter}) and (mimeType contains 'video/' or name contains '.mp4' or name contains '.mkv')`;
          const res = await drive.files.list({
            q,
            fields: 'files(id, name, size, webViewLink, videoMediaMetadata)',
            pageSize: 50,
            spaces: 'drive',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          });

          for (const file of res.data.files || []) {
            if (file.id && file.name) {
              const durSec = file.videoMediaMetadata?.durationMillis
                ? Math.round(Number(file.videoMediaMetadata.durationMillis) / 1000)
                : 60;
              allVideos.push({
                id: file.id,
                name: file.name,
                title: file.name.replace(/\.[^/.]+$/, ''),
                duration: durSec,
                sourceType: 'drive',
                driveFileId: file.id,
              });
            }
          }
        }
      }
    } catch {
      // Ignore
    }

    return allVideos;
  }
}

export const youtubeAutomationService = new YouTubeAutomationService();
