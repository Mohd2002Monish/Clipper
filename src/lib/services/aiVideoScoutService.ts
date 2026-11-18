import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { connectMongo } from '@/lib/db';
import { ClipQueue } from '@/models/ClipQueue';
import { VideoScoutSchedule, IVideoScoutScheduleDocument } from '@/models/VideoScoutSchedule';
import { logger } from '@/lib/logger/logger';
import { clipIngestionService } from '@/lib/services/clipIngestionService';

export interface CandidateVideo {
  id: string; // YouTube 11-char ID
  title: string;
  url: string;
  viewCount: number;
  durationSeconds: number;
  uploadDate: string;
  thumbnailUrl: string;
  aiScore?: number;
  aiReason?: string;
  querySource?: string;
}

export interface ParsedScoutIntent {
  searchQueries: string[];
  targetFolder: string;
  targetCount: number;
  contentTheme: string;
  autoCaption: boolean;
  captionStyle: 'viral_yellow' | 'classic_white' | 'karaoke_glow';
  autoSplit: boolean;
  partDurationSeconds: number;
}

export interface ScoutExecutionResult {
  success: boolean;
  intent: ParsedScoutIntent;
  totalFound: number;
  uniqueCandidates: number;
  selectedVideos: CandidateVideo[];
  queuedCount: number;
  alreadySeenCount: number;
  error?: string;
}

export class AiVideoScoutService {
  private tempWorkDir: string;

  constructor() {
    this.tempWorkDir = path.resolve(process.cwd(), 'storage', 'scout_temp');
    if (!fs.existsSync(this.tempWorkDir)) {
      try {
        fs.mkdirSync(this.tempWorkDir, { recursive: true });
      } catch {}
    }
  }

  /**
   * Resolves the local yt-dlp binary path on macOS / Linux
   */
  public getYtDlpPath(): string {
    if (fs.existsSync('/opt/homebrew/bin/yt-dlp')) return '/opt/homebrew/bin/yt-dlp';
    if (fs.existsSync('/usr/local/bin/yt-dlp')) return '/usr/local/bin/yt-dlp';
    const localNodeBin = path.resolve(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp');
    if (fs.existsSync(localNodeBin)) return localNodeBin;
    const projectBin = path.resolve(process.cwd(), 'bin', 'yt-dlp');
    if (fs.existsSync(projectBin)) return projectBin;
    return 'yt-dlp';
  }

  /**
   * Extracts clean 11-character YouTube video ID from various URL formats
   */
  public extractYouTubeId(rawUrl: string): string | null {
    if (!rawUrl) return null;
    const match = rawUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    return match ? match[1] : null;
  }

  /**
   * Translates natural language user prompt into structured search queries & parameters using Gemini
   */
  public async parseUserPrompt(prompt: string, folderOverride?: string): Promise<ParsedScoutIntent> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    // Strict folder assignment: if user selected a folder, honor it 100%
    let detectedFolder = folderOverride?.trim();
    if (!detectedFolder) {
      const lower = prompt.toLowerCase();
      if (lower.includes('gta') || lower.includes('gtav')) {
        detectedFolder = 'GTA-5';
      } else if (lower.includes('vault') || lower.includes('movie') || lower.includes('thriller') || lower.includes('cinema')) {
        detectedFolder = 'Movie-Vault';
      } else {
        detectedFolder = 'General';
      }
    }

    // Detect count (default 5)
    let detectedCount = 5;
    const countMatch = prompt.match(/\b(\d+)\s*(?:videos?|clips?|shorts?)\b/i);
    if (countMatch && parseInt(countMatch[1], 10) > 0) {
      detectedCount = Math.min(parseInt(countMatch[1], 10), 20);
    }

    if (!apiKey) {
      // Fallback without Gemini API
      return {
        searchQueries: [prompt, `${prompt} full video`, `${prompt} scenes`],
        targetFolder: detectedFolder,
        targetCount: detectedCount,
        contentTheme: prompt,
        autoCaption: false,
        captionStyle: 'viral_yellow',
        autoSplit: true,
        partDurationSeconds: 60,
      };
    }

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const systemInstruction = `You are an AI Video Researcher and Content Strategist.
Given a user prompt requesting video topics, return a strict JSON object with:
- "searchQueries": an array of 3 to 4 distinct, high-impact YouTube search query strings designed to find the top, high-view videos directly matching the user's prompt without forcing shorts.
- "targetFolder": "${detectedFolder}".
- "targetCount": number of videos the user asked for (between 1 and 20, default 5).
- "contentTheme": a brief 1-sentence description of the ideal winning video.
- "autoCaption": boolean, true if dynamic subtitles would improve this content.
- "captionStyle": one of ["viral_yellow", "classic_white", "karaoke_glow"].
- "partDurationSeconds": standard slice length in seconds (e.g. 60).

Respond ONLY with valid JSON. No markdown backticks, no explanations.`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemInstruction}\n\nUser Prompt: "${prompt}"` }] }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      return {
        searchQueries: Array.isArray(parsed.searchQueries) && parsed.searchQueries.length > 0
          ? parsed.searchQueries
          : [prompt, `${prompt} full video`, `${prompt} scenes`],
        targetFolder: detectedFolder,
        targetCount: parsed.targetCount || detectedCount,
        contentTheme: parsed.contentTheme || prompt,
        autoCaption: parsed.autoCaption ?? false,
        captionStyle: parsed.captionStyle || 'viral_yellow',
        autoSplit: true,
        partDurationSeconds: parsed.partDurationSeconds || 60,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.system('warn', 'SCOUT_GEMINI_PARSE_FALLBACK', `Failed to parse prompt with Gemini: ${msg}`);
      return {
        searchQueries: [prompt, `${prompt} full video`, `${prompt} scenes`],
        targetFolder: detectedFolder,
        targetCount: detectedCount,
        contentTheme: prompt,
        autoCaption: false,
        captionStyle: 'viral_yellow',
        autoSplit: true,
        partDurationSeconds: 60,
      };
    }
  }

  /**
   * Oversampled search across YouTube via yt-dlp to discover candidate videos
   */
  public async searchCandidates(queries: string[], limitPerQuery = 12): Promise<CandidateVideo[]> {
    const ytdlpBin = this.getYtDlpPath();
    const candidateMap = new Map<string, CandidateVideo>();

    for (const query of queries) {
      try {
        const cleanQuery = query.trim();
        if (!cleanQuery) continue;

        const results = await new Promise<CandidateVideo[]>((resolve) => {
          const searchArg = `ytsearch${limitPerQuery}:${cleanQuery}`;
          // Print tab-separated metadata: ID, title, URL, view_count, duration, upload_date, thumbnail
          const printFormat = '%(id)s\t%(title)s\t%(webpage_url)s\t%(view_count)s\t%(duration)s\t%(upload_date)s\t%(thumbnail)s';
          
          const proc = spawn(ytdlpBin, [
            searchArg,
            '--no-warnings',
            '--ignore-errors',
            '--print',
            printFormat,
          ]);

          let output = '';
          proc.stdout.on('data', (d) => {
            output += d.toString();
          });

          proc.on('close', () => {
            const parsed: CandidateVideo[] = [];
            const lines = output.split('\n');
            for (const line of lines) {
              const parts = line.split('\t');
              if (parts.length >= 3) {
                const id = parts[0]?.trim();
                const title = parts[1]?.trim();
                const url = parts[2]?.trim();
                const viewCount = parseInt(parts[3] || '0', 10) || 0;
                const durationSeconds = parseFloat(parts[4] || '0') || 0;
                const uploadDate = parts[5]?.trim() || '';
                const thumbnailUrl = parts[6]?.trim() || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '');

                if (id && id.length === 11 && url) {
                  parsed.push({
                    id,
                    title: title || 'Untitled Clip',
                    url,
                    viewCount,
                    durationSeconds,
                    uploadDate,
                    thumbnailUrl,
                    querySource: cleanQuery,
                  });
                }
              }
            }
            resolve(parsed);
          });

          proc.on('error', () => {
            resolve([]);
          });
        });

        for (const item of results) {
          if (!candidateMap.has(item.id)) {
            candidateMap.set(item.id, item);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.system('warn', 'SCOUT_SEARCH_QUERY_ERROR', `Search query failed "${query}": ${msg}`);
      }
    }

    return Array.from(candidateMap.values());
  }

  /**
   * Filters out any video previously queued or seen across the entire database to guarantee 100% uniqueness
   */
  public async filterUniqueCandidates(
    candidates: CandidateVideo[],
    additionalSeenIds: string[] = []
  ): Promise<{ fresh: CandidateVideo[]; duplicateCount: number }> {
    await connectMongo();

    // 1. Compile all seen IDs from schedule + memory
    const seenSet = new Set<string>(additionalSeenIds.filter(Boolean));

    // 2. Fetch all existing clean URLs from ClipQueue to guarantee global uniqueness
    const existingQueued = await ClipQueue.find({}, { cleanUrl: 1, url: 1 }).lean();
    for (const doc of existingQueued) {
      const id1 = this.extractYouTubeId(doc.cleanUrl);
      const id2 = this.extractYouTubeId(doc.url);
      if (id1) seenSet.add(id1);
      if (id2) seenSet.add(id2);
    }

    const fresh: CandidateVideo[] = [];
    let duplicateCount = 0;

    for (const video of candidates) {
      if (seenSet.has(video.id)) {
        duplicateCount++;
      } else {
        fresh.push(video);
      }
    }

    return { fresh, duplicateCount };
  }

  /**
   * Uses Gemini to evaluate and select the top N winning videos by viral velocity and prompt alignment
   */
  public async rankAndSelectWinners(
    theme: string,
    candidates: CandidateVideo[],
    targetCount: number
  ): Promise<CandidateVideo[]> {
    if (candidates.length <= targetCount) {
      return candidates.sort((a, b) => b.viewCount - a.viewCount);
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback to highest view count
      return candidates.sort((a, b) => b.viewCount - a.viewCount).slice(0, targetCount);
    }

    try {
      const candidateSummaries = candidates.map((c, idx) => ({
        index: idx,
        id: c.id,
        title: c.title,
        viewCount: c.viewCount,
        durationSeconds: c.durationSeconds,
      }));

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const promptText = `You are a viral media curator.
Target Goal: "${theme}"
Need: Select the TOP ${targetCount} best videos from this list.
Criteria: High view count, engagement potential, title appeal, and strict relevance to the target goal.

Candidates:
${JSON.stringify(candidateSummaries, null, 2)}

Respond with a JSON array containing the selected indices in ranked order, with a 1-sentence selection reason for each:
[{"index": 0, "reason": "High view velocity with compelling hook in title"}]
Strictly output JSON only.`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        const rankings: Array<{ index: number; reason: string }> = JSON.parse(clean);

        const winners: CandidateVideo[] = [];
        for (const item of rankings) {
          const video = candidates[item.index];
          if (video && !winners.some((w) => w.id === video.id)) {
            video.aiReason = item.reason;
            winners.push(video);
            if (winners.length >= targetCount) break;
          }
        }

        if (winners.length > 0) {
          return winners;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.system('warn', 'SCOUT_RANKING_FALLBACK', `Gemini ranking failed: ${msg}`);
    }

    return candidates.sort((a, b) => b.viewCount - a.viewCount).slice(0, targetCount);
  }

  /**
   * Pushes the selected videos directly into the ClipQueue and kicks off the background downloader
   */
  public async ingestWinningVideos(
    videos: CandidateVideo[],
    intent: ParsedScoutIntent,
    scheduleId?: string
  ): Promise<{ queuedCount: number; queuedIds: string[] }> {
    await connectMongo();
    const queuedIds: string[] = [];

    for (const v of videos) {
      try {
        const cleanUrl = `https://www.youtube.com/watch?v=${v.id}`;
        
        // Double check pending
        const existing = await ClipQueue.findOne({
          cleanUrl,
          status: { $in: ['pending', 'processing', 'downloading', 'completed'] },
        });

        if (existing) continue;

        const doc = await ClipQueue.create({
          url: cleanUrl,
          cleanUrl,
          platform: v.durationSeconds <= 65 ? 'youtube_shorts' : 'youtube',
          status: 'pending',
          targetFolder: {
            folderId: intent.targetFolder,
            folderName: intent.targetFolder,
          },
          contentMeta: {
            title: v.title,
            description: v.aiReason || `Auto-scouted for theme: ${intent.contentTheme}`,
            durationSeconds: v.durationSeconds,
            thumbnailUrl: v.thumbnailUrl,
            notes: `AI Video Scout: ${v.querySource || 'autonomous'}`,
          },
          processingDirectives: {
            autoSplit: intent.autoSplit,
            partDurationSeconds: intent.partDurationSeconds,
            reframeMode: intent.captionStyle ? 'blur' : 'crop',
            targetAspectRatio: '9:16',
            autoCaption: intent.autoCaption,
          },
          executionMeta: {
            attempts: 0,
            maxAttempts: 3,
            sourceClient: {
              type: scheduleId ? 'scheduler' : 'ai_video_scout',
              deviceInfo: 'VideoTimmer AI Scout Engine',
            },
          },
        });

        queuedIds.push(v.id);

        logger.system(
          'info',
          'SCOUT_CLIP_QUEUED',
          `Queued video "${v.title}" (${cleanUrl}) to folder [${intent.targetFolder}]`
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.system('error', 'SCOUT_INGEST_ERROR', `Failed to queue clip ${v.id}: ${msg}`);
      }
    }

    // Trigger local background download worker if idle
    try {
      clipIngestionService.processPendingQueue().catch(() => {});
    } catch {}

    return { queuedCount: queuedIds.length, queuedIds };
  }

  /**
   * Executes a full instant search and selection pipeline
   */
  public async executeInstantScout(prompt: string, folderOverride?: string): Promise<ScoutExecutionResult> {
    const intent = await this.parseUserPrompt(prompt, folderOverride);
    const candidates = await this.searchCandidates(intent.searchQueries, 10);
    const { fresh, duplicateCount } = await this.filterUniqueCandidates(candidates);
    const winners = await this.rankAndSelectWinners(intent.contentTheme, fresh, intent.targetCount);

    return {
      success: winners.length > 0,
      intent,
      totalFound: candidates.length,
      uniqueCandidates: fresh.length,
      selectedVideos: winners,
      queuedCount: 0,
      alreadySeenCount: duplicateCount,
    };
  }

  /**
   * Executes a recurring scheduled scout task, updates de-duplication registry, and recalculates nextRunAt
   */
  public async runScheduledTask(scheduleId: string): Promise<ScoutExecutionResult> {
    await connectMongo();
    const schedule = await VideoScoutSchedule.findById(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    logger.system('info', 'SCOUT_SCHEDULE_RUN_START', `Executing scheduled task: "${schedule.name}"`);

    const intent: ParsedScoutIntent = {
      searchQueries: schedule.searchKeywords.length > 0 ? schedule.searchKeywords : [schedule.prompt],
      targetFolder: schedule.targetFolder,
      targetCount: schedule.dailyCount,
      contentTheme: schedule.prompt,
      autoCaption: schedule.autoCaption,
      captionStyle: schedule.captionStyle,
      autoSplit: schedule.autoSplit,
      partDurationSeconds: schedule.partDurationSeconds,
    };

    // If keywords were not manually set, generate smart queries
    if (intent.searchQueries.length <= 1) {
      const parsed = await this.parseUserPrompt(schedule.prompt, schedule.targetFolder);
      intent.searchQueries = parsed.searchQueries;
    }

    const candidates = await this.searchCandidates(intent.searchQueries, 15);
    const { fresh, duplicateCount } = await this.filterUniqueCandidates(candidates, schedule.seenVideoIds);
    const winners = await this.rankAndSelectWinners(intent.contentTheme, fresh, intent.targetCount);

    const { queuedCount, queuedIds } = await this.ingestWinningVideos(winners, intent, scheduleId);

    // Update schedule document with newly seen IDs to guarantee zero duplicates on future runs
    const updatedSeen = Array.from(new Set([...schedule.seenVideoIds, ...queuedIds]));
    schedule.seenVideoIds = updatedSeen;
    schedule.totalIngestedCount += queuedCount;
    schedule.lastRunAt = new Date();

    // Compute next run time
    const nextRun = new Date();
    if (schedule.scheduleType === 'daily') {
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(schedule.cronHour, schedule.cronMinute, 0, 0);
    } else {
      nextRun.setHours(nextRun.getHours() + (schedule.intervalHours || 24));
    }
    schedule.nextRunAt = nextRun;

    schedule.lastRunResult = {
      date: new Date(),
      foundCount: candidates.length,
      queuedCount,
      videoTitles: winners.map((w) => w.title),
      status: queuedCount > 0 ? 'success' : candidates.length === 0 ? 'empty' : 'partial',
    };

    await schedule.save();

    logger.system(
      'info',
      'SCOUT_SCHEDULE_RUN_COMPLETE',
      `Completed task "${schedule.name}": Queued ${queuedCount} unique clips. Avoided ${duplicateCount} duplicates.`
    );

    return {
      success: queuedCount > 0,
      intent,
      totalFound: candidates.length,
      uniqueCandidates: fresh.length,
      selectedVideos: winners,
      queuedCount,
      alreadySeenCount: duplicateCount,
    };
  }

  /**
   * Clones an existing schedule with 1 click
   */
  public async cloneSchedule(scheduleId: string, newName?: string): Promise<IVideoScoutScheduleDocument> {
    await connectMongo();
    const original = await VideoScoutSchedule.findById(scheduleId);
    if (!original) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    const cloned = new VideoScoutSchedule({
      name: newName || `${original.name} (Copy)`,
      prompt: original.prompt,
      searchKeywords: [...original.searchKeywords],
      targetFolder: original.targetFolder,
      dailyCount: original.dailyCount,
      scheduleType: original.scheduleType,
      cronHour: original.cronHour,
      cronMinute: original.cronMinute,
      intervalHours: original.intervalHours,
      isActive: true,
      autoCaption: original.autoCaption,
      captionStyle: original.captionStyle,
      reframeMode: original.reframeMode,
      autoSplit: original.autoSplit,
      partDurationSeconds: original.partDurationSeconds,
      seenVideoIds: [...original.seenVideoIds], // Inherit seen history so clones don't re-download same clips
      totalIngestedCount: 0,
      nextRunAt: new Date(Date.now() + 60 * 1000), // Ready to run
    });

    await cloned.save();
    return cloned;
  }
}

export const aiVideoScoutService = new AiVideoScoutService();
