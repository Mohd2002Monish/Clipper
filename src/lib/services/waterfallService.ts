import { connectMongo } from '../db';
import { WaterfallPipeline, IWaterfallPipelineDocument, IWaterfallRun, IWaterfallStageRun } from '../../models/WaterfallPipeline';
import { YouTubeAccount } from '../../models/YouTubeAccount';
import { InstagramAccount } from '../../models/InstagramAccount';
import { InstagramPost } from '../../models/InstagramPost';
import { ThreadsAccount } from '../../models/ThreadsAccount';
import { ThreadsPost } from '../../models/ThreadsPost';
import { Part } from '../../models/Part';
import { Job } from '../../models/Job';
import { youtubeService } from './youtubeService';
import { instagramService } from './instagramService';
import { threadsService } from './threadsService';
import { driveService } from './driveService';
import { logger } from '../logger/logger';

export interface TriggerWaterfallOptions {
  videoTitle: string;
  sourceFilename: string;
  folderName: string;
  sourceType?: 'part' | 'drive' | 'local';
  localPath?: string;
  driveFileId?: string;
  jobId?: string;
  partIndex?: number;
  anchorDate?: Date; // T0
  customYoutubeTitle?: string;
  customInstagramCaption?: string;
  customThreadsHook?: string;
}

export class WaterfallService {
  /**
   * Retrieves all waterfall syndication pipelines.
   */
  public async getPipelines(): Promise<IWaterfallPipelineDocument[]> {
    await connectMongo();
    return WaterfallPipeline.find({ status: { $ne: 'archived' } }).sort({ createdAt: -1 });
  }

  /**
   * Retrieves a single pipeline by ID.
   */
  public async getPipeline(id: string): Promise<IWaterfallPipelineDocument | null> {
    await connectMongo();
    return WaterfallPipeline.findById(id);
  }

  /**
   * Creates a new Waterfall Pipeline.
   */
  public async createPipeline(data: {
    name: string;
    description?: string;
    folderName?: string;
    autoSyndicateNewParts?: boolean;
    stages: {
      youtube: {
        enabled: boolean;
        channelOrAccountId?: string;
        usernameOrTitle?: string;
        delayMinutes: number;
        titleOrHookTemplate?: string;
        descriptionOrCaptionTemplate?: string;
        privacyStatus?: 'public' | 'unlisted' | 'private';
        videoType?: 'short' | 'video';
      };
      instagram: {
        enabled: boolean;
        channelOrAccountId?: string;
        usernameOrTitle?: string;
        delayMinutes: number;
        descriptionOrCaptionTemplate?: string;
        shareToFeed?: boolean;
      };
      threads: {
        enabled: boolean;
        channelOrAccountId?: string;
        usernameOrTitle?: string;
        delayMinutes: number;
        titleOrHookTemplate?: string;
        ctaReplyText?: string;
      };
    };
    autoReschedule?: {
      enabled: boolean;
      alignToGoldenHours: boolean;
      randomJitterMinutes: number;
    };
  }): Promise<IWaterfallPipelineDocument> {
    await connectMongo();

    const pipeline = await WaterfallPipeline.create({
      name: data.name,
      description: data.description || '',
      folderName: data.folderName || 'General',
      autoSyndicateNewParts: data.autoSyndicateNewParts ?? false,
      status: 'active',
      stages: {
        youtube: {
          enabled: data.stages.youtube.enabled ?? true,
          channelOrAccountId: data.stages.youtube.channelOrAccountId || '',
          usernameOrTitle: data.stages.youtube.usernameOrTitle || '',
          delayMinutes: Math.max(0, data.stages.youtube.delayMinutes ?? 0),
          titleOrHookTemplate: data.stages.youtube.titleOrHookTemplate || '{title} (Part {part})',
          descriptionOrCaptionTemplate:
            data.stages.youtube.descriptionOrCaptionTemplate ||
            'Uploaded via VideoTimmer Cross-Platform Waterfall.\n\n#Shorts #Viral',
          privacyStatus: data.stages.youtube.privacyStatus || 'public',
          videoType: data.stages.youtube.videoType || 'short',
        },
        instagram: {
          enabled: data.stages.instagram.enabled ?? true,
          channelOrAccountId: data.stages.instagram.channelOrAccountId || '',
          usernameOrTitle: data.stages.instagram.usernameOrTitle || '',
          delayMinutes: Math.max(0, data.stages.instagram.delayMinutes ?? 120), // 2 hours cascade default
          descriptionOrCaptionTemplate:
            data.stages.instagram.descriptionOrCaptionTemplate ||
            '{title} (Part {part}) \n\nDouble tap if this resonates! Drop your thoughts below.\n\n#reels #viral #cinema',
          shareToFeed: data.stages.instagram.shareToFeed ?? true,
        },
        threads: {
          enabled: data.stages.threads.enabled ?? true,
          channelOrAccountId: data.stages.threads.channelOrAccountId || '',
          usernameOrTitle: data.stages.threads.usernameOrTitle || '',
          delayMinutes: Math.max(0, data.stages.threads.delayMinutes ?? 240), // 4 hours cascade default
          titleOrHookTemplate:
            data.stages.threads.titleOrHookTemplate ||
            '{title} — Part {part}. Did you notice this key moment?',
          ctaReplyText:
            data.stages.threads.ctaReplyText ||
            "I've spent 1000s of hours finding movies that most people never discover. I'm building a curated Movie Vault filled with hidden gems, mind-bending thrillers, and underrated masterpieces. Comment #VAULT if you want early access when it launches.",
        },
      },
      autoReschedule: {
        enabled: data.autoReschedule?.enabled ?? true,
        alignToGoldenHours: data.autoReschedule?.alignToGoldenHours ?? true,
        randomJitterMinutes: data.autoReschedule?.randomJitterMinutes ?? 10,
      },
      runs: [],
    });

    logger.system('info', 'WATERFALL_PIPELINE_CREATED', `Created waterfall pipeline "${pipeline.name}" (${pipeline._id})`);
    return pipeline;
  }

  /**
   * Updates an existing pipeline.
   */
  public async updatePipeline(
    id: string,
    updates: Partial<IWaterfallPipelineDocument>
  ): Promise<IWaterfallPipelineDocument | null> {
    await connectMongo();
    return WaterfallPipeline.findByIdAndUpdate(id, updates, { new: true });
  }

  /**
   * Archives/deletes a pipeline.
   */
  public async deletePipeline(id: string): Promise<boolean> {
    await connectMongo();
    const res = await WaterfallPipeline.findByIdAndUpdate(id, { status: 'archived' });
    return !!res;
  }

  /**
   * Triggers a Waterfall Run for a specific video across YouTube, Instagram, and Threads.
   * Staggers the dispatches according to stage delay offsets.
   */
  public async triggerWaterfallRun(
    pipelineId: string,
    opts: TriggerWaterfallOptions
  ): Promise<{ success: boolean; run: IWaterfallRun; error?: string }> {
    await connectMongo();

    const pipeline = await WaterfallPipeline.findById(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found.`);
    }

    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const anchor = opts.anchorDate || new Date();
    const partNum = opts.partIndex || 1;

    const interpolate = (tpl?: string) => {
      if (!tpl) return '';
      return tpl
        .replace(/{title}/gi, opts.videoTitle)
        .replace(/{part}/gi, String(partNum))
        .replace(/{folder}/gi, opts.folderName);
    };

    const stageRuns: IWaterfallStageRun[] = [];

    // --- Stage 1: YouTube ---
    if (pipeline.stages.youtube.enabled) {
      const delayMs = pipeline.stages.youtube.delayMinutes * 60 * 1000;
      const scheduledAt = new Date(anchor.getTime() + delayMs);
      const title = opts.customYoutubeTitle || interpolate(pipeline.stages.youtube.titleOrHookTemplate);
      const desc = interpolate(pipeline.stages.youtube.descriptionOrCaptionTemplate);

      let externalId: string | undefined = undefined;
      let permalink: string | undefined = undefined;
      let stageStatus: IWaterfallStageRun['status'] = 'scheduled';
      let stageError: string | undefined = undefined;

      // If delay is 0 and anchor is roughly now, execute upload immediately
      if (pipeline.stages.youtube.delayMinutes === 0 && Math.abs(scheduledAt.getTime() - Date.now()) < 60000) {
        try {
          const ytChannel =
            pipeline.stages.youtube.channelOrAccountId ||
            (await YouTubeAccount.findOne({ isActive: true }))?.channelId;

          if (ytChannel) {
            stageStatus = 'publishing';
            const uploadRes = await youtubeService.uploadVideo({
              channelId: ytChannel,
              folderName: opts.folderName,
              sourceType: opts.sourceType === 'drive' ? 'drive' : 'local',
              localPath: opts.localPath,
              driveFileId: opts.driveFileId,
              title: title || opts.videoTitle,
              description: desc,
              privacyStatus: pipeline.stages.youtube.privacyStatus || 'public',
              videoType: pipeline.stages.youtube.videoType === 'video' ? 'long_form' : 'short',
              partIndex: opts.partIndex,
              partFilename: opts.sourceFilename,
            });

            if (uploadRes.videoId) {
              externalId = uploadRes.videoId;
              permalink = `https://youtube.com/watch?v=${uploadRes.videoId}`;
              stageStatus = 'published';
            }
          }
        } catch (err: unknown) {
          stageStatus = 'failed';
          stageError = err instanceof Error ? err.message : String(err);
          logger.system('error', 'WATERFALL_YT_ERROR', `YouTube stage failed: ${stageError}`);
        }
      }

      stageRuns.push({
        platform: 'youtube',
        status: stageStatus,
        scheduledAt,
        publishedAt: stageStatus === 'published' ? new Date() : undefined,
        externalId,
        permalink,
        error: stageError,
        metrics: { views: 0, likes: 0, commentsOrReplies: 0 },
      });
    }

    // --- Stage 2: Instagram (Reel) ---
    if (pipeline.stages.instagram.enabled) {
      const delayMs = pipeline.stages.instagram.delayMinutes * 60 * 1000;
      const scheduledAt = new Date(anchor.getTime() + delayMs);
      const caption = opts.customInstagramCaption || interpolate(pipeline.stages.instagram.descriptionOrCaptionTemplate);

      let stageStatus: IWaterfallStageRun['status'] = 'scheduled';
      let externalId: string | undefined = undefined;
      let permalink: string | undefined = undefined;
      let stageError: string | undefined = undefined;

      try {
        const igAccount =
          pipeline.stages.instagram.channelOrAccountId
            ? await InstagramAccount.findById(pipeline.stages.instagram.channelOrAccountId)
            : await InstagramAccount.findOne({ isActive: true });

        if (igAccount) {
          const igPost = await InstagramPost.create({
            accountId: igAccount._id.toString(),
            username: igAccount.username,
            caption: caption || opts.videoTitle,
            mediaType: 'REELS',
            mediaUrl: opts.localPath || opts.sourceFilename,
            shareToFeed: pipeline.stages.instagram.shareToFeed ?? true,
            status: 'scheduled',
            scheduleAt: scheduledAt,
            videoSource: {
              sourceType: opts.sourceType || 'local',
              jobId: opts.jobId,
              partIndex: opts.partIndex,
              filename: opts.sourceFilename,
            },
          });
          externalId = igPost._id.toString();
        } else {
          stageStatus = 'failed';
          stageError = 'No active Instagram account connected.';
        }
      } catch (err: unknown) {
        stageStatus = 'failed';
        stageError = err instanceof Error ? err.message : String(err);
      }

      stageRuns.push({
        platform: 'instagram',
        status: stageStatus,
        scheduledAt,
        externalId,
        permalink,
        error: stageError,
        metrics: { views: 0, likes: 0, commentsOrReplies: 0 },
      });
    }

    // --- Stage 3: Threads (Hook + CTA) ---
    if (pipeline.stages.threads.enabled) {
      const delayMs = pipeline.stages.threads.delayMinutes * 60 * 1000;
      const scheduledAt = new Date(anchor.getTime() + delayMs);
      const hookText = opts.customThreadsHook || interpolate(pipeline.stages.threads.titleOrHookTemplate);
      const ctaReply = interpolate(pipeline.stages.threads.ctaReplyText);

      let stageStatus: IWaterfallStageRun['status'] = 'scheduled';
      let externalId: string | undefined = undefined;
      let permalink: string | undefined = undefined;
      let stageError: string | undefined = undefined;

      try {
        const thAccount =
          pipeline.stages.threads.channelOrAccountId
            ? await ThreadsAccount.findById(pipeline.stages.threads.channelOrAccountId)
            : await ThreadsAccount.findOne({ isActive: true });

        if (thAccount) {
          const thPost = await ThreadsPost.create({
            accountId: thAccount._id.toString(),
            username: thAccount.username,
            posts: [
              {
                text: hookText || opts.videoTitle,
                mediaUrl: opts.localPath || opts.sourceFilename,
                mediaType: 'VIDEO',
              },
            ],
            status: 'scheduled',
            scheduleAt: scheduledAt,
            followUp: ctaReply
              ? {
                  enabled: true,
                  text: ctaReply,
                  delayMinutes: 5,
                  status: 'pending',
                }
              : undefined,
            videoSource: {
              sourceType: opts.sourceType || 'local',
              jobId: opts.jobId,
              partIndex: opts.partIndex,
              filename: opts.sourceFilename,
            },
          });
          externalId = thPost._id.toString();
        } else {
          stageStatus = 'failed';
          stageError = 'No active Threads account connected.';
        }
      } catch (err: unknown) {
        stageStatus = 'failed';
        stageError = err instanceof Error ? err.message : String(err);
      }

      stageRuns.push({
        platform: 'threads',
        status: stageStatus,
        scheduledAt,
        externalId,
        permalink,
        error: stageError,
        metrics: { views: 0, likes: 0, commentsOrReplies: 0 },
      });
    }

    const hasAnyFailed = stageRuns.some((s) => s.status === 'failed');
    const allCompleted = stageRuns.every((s) => s.status === 'published');

    const newRun: IWaterfallRun = {
      runId,
      videoTitle: opts.videoTitle,
      sourceType: opts.sourceType || 'local',
      sourceFilename: opts.sourceFilename,
      folderName: opts.folderName,
      jobId: opts.jobId,
      partIndex: opts.partIndex,
      localPath: opts.localPath,
      driveFileId: opts.driveFileId,
      status: allCompleted ? 'completed' : hasAnyFailed ? 'partial_failure' : 'in_progress',
      startedAt: anchor,
      stages: stageRuns,
    };

    pipeline.runs.unshift(newRun);
    // Keep max 50 recent runs per pipeline
    if (pipeline.runs.length > 50) {
      pipeline.runs = pipeline.runs.slice(0, 50);
    }
    await pipeline.save();

    logger.system(
      'info',
      'WATERFALL_RUN_TRIGGERED',
      `Triggered Waterfall "${pipeline.name}" run ${runId} for "${opts.videoTitle}" across ${stageRuns.length} stages`
    );

    return { success: true, run: newRun };
  }

  /**
   * Scans all completed video parts and Drive videos available for syndication.
   */
  public async getAvailableVideos(folderName?: string): Promise<
    Array<{
      id: string;
      title: string;
      sourceFilename: string;
      sourceType: 'part' | 'drive';
      folderName: string;
      jobId?: string;
      partIndex?: number;
      duration?: number;
      outputPath?: string;
      driveFileId?: string;
      thumbnailUrl?: string;
      createdAt: Date;
    }>
  > {
    await connectMongo();

    const results: Array<{
      id: string;
      title: string;
      sourceFilename: string;
      sourceType: 'part' | 'drive';
      folderName: string;
      jobId?: string;
      partIndex?: number;
      duration?: number;
      outputPath?: string;
      driveFileId?: string;
      thumbnailUrl?: string;
      createdAt: Date;
    }> = [];

    // 1. Fetch completed parts from recent jobs
    const partQuery: Record<string, unknown> = { status: { $in: ['rendered', 'uploaded'] } };
    const parts = await Part.find(partQuery).sort({ createdAt: -1 }).limit(40).lean();

    for (const p of parts) {
      results.push({
        id: p._id.toString(),
        title: p.filename?.replace(/\.mp4$/i, '').replace(/_/g, ' ') || `Part ${p.index}`,
        sourceFilename: p.filename || `part_${p.index}.mp4`,
        sourceType: 'part',
        folderName: folderName || 'General',
        jobId: p.jobId,
        partIndex: p.index,
        duration: p.duration,
        outputPath: p.localPath,
        createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
      });
    }

    // 2. Fetch Drive videos if configured
    try {
      const drive = await driveService.getAuthenticatedDrive();
      if (drive) {
        const driveRes = await drive.files.list({
          q: "mimeType contains 'video/' and trashed = false",
          fields: 'files(id, name, mimeType, thumbnailLink, createdTime)',
          pageSize: 30,
        });
        const driveFiles = driveRes.data.files || [];
        for (const f of driveFiles) {
          if (f.id && f.name) {
            results.push({
              id: f.id,
              title: f.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
              sourceFilename: f.name,
              sourceType: 'drive',
              folderName: folderName || 'Google Drive',
              driveFileId: f.id,
              thumbnailUrl: f.thumbnailLink || undefined,
              createdAt: f.createdTime ? new Date(f.createdTime) : new Date(),
            });
          }
        }
      }
    } catch {
      // Non-blocking if Drive is not signed in
    }

    return results;
  }
}

export const waterfallService = new WaterfallService();
