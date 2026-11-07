import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { connectMongo } from '@/lib/db';
import { OmniPipeline, IOmniPipelineDocument } from '@/models/OmniPipeline';
import { YouTubeAccount } from '@/models/YouTubeAccount';
import { InstagramAccount } from '@/models/InstagramAccount';
import { FacebookAccount } from '@/models/FacebookAccount';
import { ThreadsAccount } from '@/models/ThreadsAccount';
import { InstagramPost } from '@/models/InstagramPost';
import { FacebookPost } from '@/models/FacebookPost';
import { ThreadsPost } from '@/models/ThreadsPost';
import { driveService } from './driveService';
import { youtubeService } from './youtubeService';
import { instagramService } from './instagramService';
import { facebookService } from './facebookService';
import { threadsService } from './threadsService';
import { Setting } from '@/models/Setting';
import { logger } from '@/lib/logger/logger';

export const MOVIE_VAULT_CTA =
  "I've spent 1000s of hours finding movies that most people never discover. I'm building a curated Movie Vault filled with hidden gems, mind-bending thrillers, unforgettable endings, and underrated masterpieces. Comment #VAULT if you want early access when it launches.";

export interface PipelineAccountsSummary {
  youtube: Array<{ channelId: string; channelTitle: string }>;
  instagram: Array<{ accountId: string; username: string }>;
  facebook: Array<{ accountId: string; pageId: string; pageName: string }>;
  threads: Array<{ accountId: string; username: string }>;
}

export class OmniPipelineService {
  private tempDir: string;

  constructor() {
    this.tempDir = path.resolve(process.cwd(), 'storage', 'temp_ingest');
    if (!fs.existsSync(this.tempDir)) {
      try {
        fs.mkdirSync(this.tempDir, { recursive: true });
      } catch {}
    }
  }

  /**
   * Aggregates connected accounts across all 4 platforms
   */
  public async getAccountsSummary(): Promise<PipelineAccountsSummary> {
    await connectMongo();
    const [ytAccounts, igAccounts, fbAccounts, thAccounts] = await Promise.all([
      YouTubeAccount.find({}).sort({ updatedAt: -1 }),
      InstagramAccount.find({}).sort({ updatedAt: -1 }),
      FacebookAccount.find({}).sort({ updatedAt: -1 }),
      ThreadsAccount.find({}).sort({ updatedAt: -1 }),
    ]);

    return {
      youtube: ytAccounts.map((a) => ({
        channelId: a.channelId,
        channelTitle: a.channelTitle || 'YouTube Channel',
      })),
      instagram: igAccounts.map((a) => ({
        accountId: a._id.toString(),
        username: a.username,
      })),
      facebook: fbAccounts.map((a) => ({
        accountId: a._id.toString(),
        pageId: a.pageId,
        pageName: a.pageName || 'Facebook Page',
      })),
      threads: thAccounts.map((a) => ({
        accountId: a._id.toString(),
        username: a.username,
      })),
    };
  }

  /**
   * Retrieves available Drive folders for source selection
   */
  public async getAvailableFolders(): Promise<Array<{ id: string; name: string }>> {
    try {
      const subfolders = await driveService.listSubfolders();
      const standardFolders = ['Shorts', 'Movie-Vault', 'GTA-5', 'General'];

      const merged = [...subfolders];
      for (const std of standardFolders) {
        if (!merged.some((m) => m.name.toLowerCase() === std.toLowerCase())) {
          merged.push({ id: `preset_${std.toLowerCase()}`, name: std });
        }
      }
      return merged;
    } catch {
      return [
        { id: 'preset_shorts', name: 'Shorts' },
        { id: 'preset_vault', name: 'Movie-Vault' },
        { id: 'preset_gta', name: 'GTA-5' },
        { id: 'preset_general', name: 'General' },
      ];
    }
  }

  /**
   * Extracts a video frame thumbnail at a given timestamp using FFmpeg
   */
  public async extractThumbnail(videoPath: string, timestampSeconds: number = 1.0): Promise<string> {
    const thumbFilename = `thumb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
    const thumbPath = path.join(this.tempDir, thumbFilename);

    const ffmpegPath = '/opt/homebrew/bin/ffmpeg';
    const bin = fs.existsSync(ffmpegPath) ? ffmpegPath : 'ffmpeg';

    const args = [
      '-y',
      '-ss', String(timestampSeconds),
      '-i', videoPath,
      '-vframes', '1',
      '-q:v', '2',
      thumbPath,
    ];

    return new Promise((resolve) => {
      const proc = spawn(bin, args);
      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(thumbPath)) {
          resolve(thumbPath);
        } else {
          resolve('');
        }
      });
      proc.on('error', () => {
        resolve('');
      });
    });
  }

  /**
   * Computes the next scheduled run slot
   */
  public computeNextSlot(schedule: { mode: string; goldenSlots: number[]; intervalHours: number }): Date {
    const now = new Date();

    if (schedule.mode === 'interval') {
      const next = new Date(now.getTime() + schedule.intervalHours * 3600000);
      return next;
    }

    // Default: Golden slots (e.g. 9, 14, 21, 23, 1)
    const slots = (schedule.goldenSlots || [9, 14, 21, 23, 1]).sort((a, b) => a - b);
    const currentHour = now.getHours();

    for (const slotHour of slots) {
      if (slotHour > currentHour) {
        const next = new Date(now);
        next.setHours(slotHour, 0, 0, 0);
        return next;
      }
    }

    // Wrap to next day's first slot
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(slots[0] || 9, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Formulates captions and hashtags based on pipeline template
   */
  public buildCaption(
    title: string,
    template: string,
    hashtags: string[],
    enableVaultCta: boolean
  ): { mainText: string; vaultCta: string } {
    const tagsString = hashtags.join(' ');
    let text = template || '{{title}}\n\n{{hashtags}}';
    text = text.replace(/\{\{title\}\}/g, title);
    text = text.replace(/\{\{hashtags\}\}/g, tagsString);

    return {
      mainText: text.trim(),
      vaultCta: enableVaultCta ? MOVIE_VAULT_CTA : '',
    };
  }

  /**
   * Triggers pipeline execution: pulls next unposted video from Drive,
   * generates thumbnail and captions, and posts across all selected channels
   */
  public async runPipeline(pipelineId: string): Promise<{
    success: boolean;
    message: string;
    videoTitle?: string;
    dispatched?: Record<string, any>;
  }> {
    await connectMongo();
    const pipeline = await OmniPipeline.findById(pipelineId);
    if (!pipeline) {
      return { success: false, message: 'Pipeline not found.' };
    }

    logger.system('info', 'PIPELINE_RUN_START', `Starting pipeline execution: "${pipeline.name}"`);

    // 1. Resolve Target Drive Folder ID
    let targetFolderId = pipeline.folderId;
    if (!targetFolderId || targetFolderId === 'root' || targetFolderId.startsWith('preset_')) {
      const setting = await Setting.findOne();
      const baseFolderId = setting?.googleDrive?.folderId;
      if (baseFolderId) {
        targetFolderId = await driveService.ensureSubfolder(baseFolderId, pipeline.folderName);
        pipeline.folderId = targetFolderId;
        await pipeline.save();
      } else {
        targetFolderId = 'root';
      }
    }

    // 2. Discover Videos in Folder
    let folderVideos = await driveService.listFolderVideos(targetFolderId);

    // Filter unposted
    const postedSet = new Set(pipeline.stats.postedVideoIds || []);
    let unposted = folderVideos.filter((v) => !postedSet.has(v.id));

    if (unposted.length === 0) {
      // If all videos in Drive folder have been posted, check if any videos exist in local temp
      return {
        success: false,
        message: `All ${folderVideos.length} videos in Drive folder "${pipeline.folderName}" have already been posted by this pipeline. Add new videos to continue auto-pilot.`,
      };
    }

    const videoItem = unposted[0];
    const cleanTitle = videoItem.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[/\\?%*:|"<>_]/g, ' ')
      .trim();

    logger.system('info', 'PIPELINE_VIDEO_SELECTED', `Selected video "${cleanTitle}" (ID: ${videoItem.id}) for syndication`);

    // 3. Download Video to Local Staging
    const localVideoFilename = `pipe_${Date.now()}_${videoItem.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const localVideoPath = path.join(this.tempDir, localVideoFilename);

    await driveService.downloadFile(videoItem.id, localVideoPath);

    if (!fs.existsSync(localVideoPath)) {
      throw new Error(`Failed to stage video to local disk: ${localVideoPath}`);
    }

    // 4. Extract / Resolve Thumbnail
    let defaultThumbnailPath = '';
    const thumbMode = pipeline.thumbnails?.mode || 'auto_frame';
    const timestampSec = pipeline.thumbnails?.frameTimestampSeconds || 1.0;

    if (thumbMode === 'auto_frame') {
      defaultThumbnailPath = await this.extractThumbnail(localVideoPath, timestampSec);
    }

    // Per-channel thumbnail helper
    const getThumbnailForChannel = async (channelKey: 'youtube' | 'instagram' | 'facebook' | 'threads') => {
      const override = pipeline.thumbnails?.channelOverrides?.[channelKey];
      if (override?.mode === 'auto_frame' && typeof override.frameTimestampSeconds === 'number') {
        try {
          return await this.extractThumbnail(localVideoPath, override.frameTimestampSeconds);
        } catch {
          return defaultThumbnailPath;
        }
      }
      return defaultThumbnailPath;
    };

    // 5. Generate Captions & Hashtags (Unified or Per-Channel)
    const getCaptionForChannel = (channelKey: 'youtube' | 'instagram' | 'facebook' | 'threads') => {
      const overrideTemplate = pipeline.captions?.customOverrides?.[channelKey];
      const templateToUse = (overrideTemplate && overrideTemplate.trim().length > 0)
        ? overrideTemplate
        : (pipeline.captions?.template || '{{title}}\n\n{{hashtags}}');

      return this.buildCaption(
        cleanTitle,
        templateToUse,
        pipeline.captions?.hashtags || ['#Shorts', '#Cinema', '#MovieVault', '#Bollywood'],
        Boolean(pipeline.captions?.enableVaultCta)
      );
    };

    const dispatchedResults: Record<string, any> = {};

    // 6. Multi-Platform Syndication Dispatch

    // A. YouTube Shorts
    if (pipeline.targets.youtube?.enabled && pipeline.targets.youtube.channelId) {
      try {
        const ytCaption = getCaptionForChannel('youtube');
        const ytThumb = await getThumbnailForChannel('youtube');

        const ytUpload = await youtubeService.uploadVideo({
          channelId: pipeline.targets.youtube.channelId,
          folderName: pipeline.folderName || 'Shorts',
          sourceType: 'local',
          localPath: localVideoPath,
          title: cleanTitle.length > 90 ? `${cleanTitle.substring(0, 87)}... #Shorts` : `${cleanTitle} #Shorts`,
          description: `${ytCaption.mainText}\n\n${ytCaption.vaultCta}`.trim(),
          privacyStatus: pipeline.targets.youtube.privacyStatus || 'public',
          videoType: pipeline.targets.youtube.videoType || 'short',
          tags: pipeline.captions?.hashtags?.map((t) => t.replace(/^#/, '')) || ['Shorts', 'Cinema'],
          thumbnailPath: ytThumb || undefined,
        });

        dispatchedResults.youtube = {
          success: true,
          videoId: ytUpload.videoId,
          videoUrl: `https://youtube.com/shorts/${ytUpload.videoId}`,
        };
      } catch (err: any) {
        dispatchedResults.youtube = { success: false, error: String(err?.message || err) };
      }
    }

    // B. Instagram Reels
    if (pipeline.targets.instagram?.enabled && pipeline.targets.instagram.accountId) {
      try {
        const igCaption = getCaptionForChannel('instagram');

        const igPost = await InstagramPost.create({
          accountId: pipeline.targets.instagram.accountId,
          username: pipeline.targets.instagram.username || 'instagram_user',
          caption: igCaption.mainText,
          status: 'draft',
          shareToFeed: pipeline.targets.instagram.shareToFeed ?? true,
          mediaType: 'REELS',
          mediaUrl: videoItem.webViewLink || '',
          videoSource: {
            sourceType: 'part',
            filename: videoItem.name,
          },
          firstComment: igCaption.vaultCta
            ? {
                enabled: true,
                text: igCaption.vaultCta,
                status: 'pending',
              }
            : undefined,
        });

        const igPub = await instagramService.publishPost(igPost._id.toString());
        dispatchedResults.instagram = {
          success: igPub.success,
          permalink: igPub.permalink,
          error: igPub.error,
        };
      } catch (err: any) {
        dispatchedResults.instagram = { success: false, error: String(err?.message || err) };
      }
    }

    // C. Facebook Page
    if (pipeline.targets.facebook?.enabled && pipeline.targets.facebook.accountId) {
      try {
        const fbCaption = getCaptionForChannel('facebook');

        const fbPost = await FacebookPost.create({
          accountId: pipeline.targets.facebook.accountId,
          pageId: pipeline.targets.facebook.pageId || 'fb_page',
          pageName: pipeline.targets.facebook.pageName || 'Facebook Page',
          title: cleanTitle,
          message: fbCaption.mainText,
          postType: 'REEL',
          mediaUrl: videoItem.webViewLink || '',
          status: 'draft',
          videoSource: {
            sourceType: 'part',
            filename: videoItem.name,
          },
          firstComment: fbCaption.vaultCta
            ? {
                enabled: true,
                text: fbCaption.vaultCta,
                status: 'pending',
              }
            : undefined,
        });

        const fbPub = await facebookService.publishPost(fbPost._id.toString());
        dispatchedResults.facebook = {
          success: fbPub.success,
          permalink: fbPub.permalink,
          error: fbPub.error,
        };
      } catch (err: any) {
        dispatchedResults.facebook = { success: false, error: String(err?.message || err) };
      }
    }

    // D. Threads
    if (pipeline.targets.threads?.enabled && pipeline.targets.threads.accountId) {
      try {
        const thCaption = getCaptionForChannel('threads');

        const thPost = await ThreadsPost.create({
          accountId: pipeline.targets.threads.accountId,
          username: pipeline.targets.threads.username || 'threads_user',
          posts: [
            {
              text: thCaption.mainText,
              mediaUrl: videoItem.webViewLink || '',
              mediaType: 'VIDEO',
              topic: pipeline.targets.threads.topic || 'Movies',
            },
          ],
          status: 'draft',
          videoSource: {
            sourceType: 'part',
            filename: videoItem.name,
          },
          followUp: thCaption.vaultCta
            ? {
                enabled: true,
                text: thCaption.vaultCta,
                delayMinutes: 2,
                status: 'pending',
              }
            : undefined,
        });

        const thPub = await threadsService.publishPost(thPost._id.toString());
        dispatchedResults.threads = {
          success: thPub.success,
          permalink: thPub.permalink,
          error: thPub.error,
        };
      } catch (err: any) {
        dispatchedResults.threads = { success: false, error: String(err?.message || err) };
      }
    }

    // 7. Update Pipeline Stats & Schedule
    const successfulDispatches = Object.values(dispatchedResults).filter((r: any) => r.success).length;

    pipeline.stats.totalVideosProcessed = (pipeline.stats.totalVideosProcessed || 0) + 1;
    pipeline.stats.totalPostsCreated = (pipeline.stats.totalPostsCreated || 0) + successfulDispatches;
    pipeline.stats.lastVideoTitle = cleanTitle;
    pipeline.stats.lastVideoId = videoItem.id;

    if (!pipeline.stats.postedVideoIds) pipeline.stats.postedVideoIds = [];
    pipeline.stats.postedVideoIds.push(videoItem.id);

    pipeline.schedule.lastRunAt = new Date();
    pipeline.schedule.nextRunSlot = this.computeNextSlot(pipeline.schedule);

    await pipeline.save();

    // 8. Clean up local files
    try {
      if (fs.existsSync(localVideoPath)) fs.unlinkSync(localVideoPath);
      if (defaultThumbnailPath && fs.existsSync(defaultThumbnailPath)) fs.unlinkSync(defaultThumbnailPath);
    } catch {}

    logger.system(
      'info',
      'PIPELINE_RUN_COMPLETED',
      `Pipeline "${pipeline.name}" published "${cleanTitle}" across ${successfulDispatches} channels.`
    );

    return {
      success: true,
      message: `Successfully syndicated "${cleanTitle}" to ${successfulDispatches} platforms.`,
      videoTitle: cleanTitle,
      dispatched: dispatchedResults,
    };
  }
}

export const omniPipelineService = new OmniPipelineService();
