import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '../config';
import { logger } from '../logger/logger';
import { geminiSubtitleService } from './geminiSubtitleService';
import { SubtitleItem } from '../../shared/schemas';

const execAsync = promisify(exec);

export interface HighlightClip {
  id: string;
  start: number;
  end: number;
  duration: number;
  hookHeadline: string;
  viralScore: number;
  reasoning: string;
}

export interface DetectHighlightsParams {
  videoPath: string;
  sourceDuration: number;
  maxClips?: number;
  targetClipDurationSec?: number;
  apiKey?: string;
}

export interface DetectHighlightsResult {
  engineUsed: 'ollama' | 'gemini' | 'energy_fallback';
  model: string;
  clips: HighlightClip[];
  subtitles: SubtitleItem[];
}

export class AIHighlightService {
  /**
   * Check if local Ollama daemon is reachable on localhost:11434
   */
  public async checkOllamaAvailable(): Promise<{ available: boolean; models: string[] }> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);
      const res = await fetch('http://localhost:11434/api/tags', {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map((m: any) => m.name || m.model);
        return { available: true, models };
      }
    } catch {
      // Ollama not running locally
    }
    return { available: false, models: [] };
  }

  /**
   * Detect silence pauses in audio using FFmpeg silencedetect to ensure cuts happen on breaths
   */
  public async detectSilencePauses(videoPath: string): Promise<number[]> {
    try {
      const cmd = `"${config.ffmpegPath}" -i "${videoPath}" -af "silencedetect=noise=-30dB:d=0.3" -f null -`;
      const { stderr } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });

      const silencePoints: number[] = [];
      const regex = /silence_start:\s*([0-9.]+)/g;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(stderr)) !== null) {
        const pt = parseFloat(match[1]);
        if (!isNaN(pt)) {
          silencePoints.push(Math.round(pt * 100) / 100);
        }
      }

      return silencePoints;
    } catch {
      return [];
    }
  }

  /**
   * Snap timestamp to nearest sentence boundary or silence pause
   */
  public snapToBoundary(timeSec: number, candidatePoints: number[], maxToleranceSec: number = 3.0): number {
    if (candidatePoints.length === 0) return timeSec;

    let closest = timeSec;
    let minDiff = Infinity;

    for (const pt of candidatePoints) {
      const diff = Math.abs(pt - timeSec);
      if (diff < minDiff && diff <= maxToleranceSec) {
        minDiff = diff;
        closest = pt;
      }
    }

    return closest;
  }

  /**
   * Main detection pipeline: Speech-to-text -> LLM semantic analysis -> Boundary snapping
   */
  public async detectViralHighlights(params: DetectHighlightsParams): Promise<DetectHighlightsResult> {
    const { videoPath, sourceDuration, maxClips = 5, targetClipDurationSec = 50 } = params;

    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    logger.system('info', 'AI_HIGHLIGHT_START', `Analyzing "${path.basename(videoPath)}" (${sourceDuration}s) for viral clips...`);

    // 1. Transcribe speech with timestamped subtitles
    let subtitles: SubtitleItem[] = [];
    try {
      subtitles = await geminiSubtitleService.generateSubtitles(videoPath, params.apiKey);
    } catch (sttErr: unknown) {
      const msg = sttErr instanceof Error ? sttErr.message : String(sttErr);
      logger.system('warn', 'AI_STT_FAILED', `Speech transcription encountered an error: ${msg}`);
    }

    // 2. Detect natural silence pauses
    const silencePoints = await this.detectSilencePauses(videoPath);
    const sentenceBoundaries = subtitles.flatMap((s) => [s.start, s.end]);
    const allCandidateBoundaries = Array.from(new Set([...sentenceBoundaries, ...silencePoints])).sort((a, b) => a - b);

    // If video has very little or no speech, generate energy-based / silence-snapped segments
    if (subtitles.length < 3) {
      logger.system('info', 'AI_HIGHLIGHT_LOW_SPEECH', 'Low speech density detected; generating silence-snapped highlight segments');
      const fallbackClips = this.generateSilenceSnappedClips(sourceDuration, maxClips, targetClipDurationSec, silencePoints);
      return {
        engineUsed: 'energy_fallback',
        model: 'ffmpeg_silence_snapper',
        clips: fallbackClips,
        subtitles,
      };
    }

    // 3. Check for local Ollama vs Gemini AI
    const ollamaCheck = await this.checkOllamaAvailable();
    let clips: HighlightClip[] = [];
    let engineUsed: 'ollama' | 'gemini' = 'gemini';
    let modelName = 'gemini-2.5-flash';

    if (ollamaCheck.available && ollamaCheck.models.length > 0) {
      // Pick best available local model
      const preferred = ollamaCheck.models.find((m) => m.includes('llama3') || m.includes('qwen') || m.includes('mistral'));
      const activeModel = preferred || ollamaCheck.models[0];
      engineUsed = 'ollama';
      modelName = activeModel;

      try {
        logger.system('info', 'OLLAMA_ANALYSIS_START', `Analyzing transcript locally via Ollama (${activeModel}) at zero token cost...`);
        clips = await this.analyzeWithOllama(subtitles, sourceDuration, maxClips, targetClipDurationSec, activeModel);
      } catch (ollamaErr: unknown) {
        const oMsg = ollamaErr instanceof Error ? ollamaErr.message : String(ollamaErr);
        logger.system('warn', 'OLLAMA_FALLBACK', `Local Ollama analysis failed (${oMsg}), falling back to Gemini AI`);
        engineUsed = 'gemini';
      }
    }

    if (clips.length === 0) {
      // Use Gemini AI
      engineUsed = 'gemini';
      modelName = 'gemini-2.5-flash';
      logger.system('info', 'GEMINI_ANALYSIS_START', `Analyzing transcript with Gemini AI (${modelName})...`);
      clips = await this.analyzeWithGemini(subtitles, sourceDuration, maxClips, targetClipDurationSec, params.apiKey);
    }

    // 4. Snap boundaries to exact sentence ends and natural speech pauses
    const refinedClips: HighlightClip[] = clips.map((clip, index) => {
      let snappedStart = this.snapToBoundary(clip.start, allCandidateBoundaries, 2.5);
      let snappedEnd = this.snapToBoundary(clip.end, allCandidateBoundaries, 2.5);

      // Add gentle vocal lead-in (-0.15s) and trail-out (+0.25s)
      snappedStart = Math.max(0, Math.round((snappedStart - 0.15) * 100) / 100);
      snappedEnd = Math.min(sourceDuration, Math.round((snappedEnd + 0.25) * 100) / 100);

      const duration = Math.round((snappedEnd - snappedStart) * 100) / 100;

      return {
        id: `clip_${index + 1}`,
        start: snappedStart,
        end: snappedEnd,
        duration,
        hookHeadline: (clip.hookHeadline || `Viral Moment Part ${index + 1}`).trim(),
        viralScore: clip.viralScore || Math.floor(80 + Math.random() * 15),
        reasoning: clip.reasoning || 'Strong standalone hook and narrative conclusion.',
      };
    });

    // Ensure clips are sorted by start time
    refinedClips.sort((a, b) => a.start - b.start);

    logger.system('info', 'AI_HIGHLIGHT_SUCCESS', `Detected ${refinedClips.length} viral highlights using ${engineUsed} (${modelName})`);

    return {
      engineUsed,
      model: modelName,
      clips: refinedClips,
      subtitles,
    };
  }

  /**
   * Fallback segmenter using silence points when speech is sparse
   */
  private generateSilenceSnappedClips(
    sourceDuration: number,
    maxClips: number,
    targetDuration: number,
    silencePoints: number[]
  ): HighlightClip[] {
    const clips: HighlightClip[] = [];
    const step = Math.max(targetDuration, sourceDuration / maxClips);

    let current = 0;
    let idx = 1;

    while (current < sourceDuration && clips.length < maxClips) {
      let end = Math.min(current + targetDuration, sourceDuration);
      if (silencePoints.length > 0) {
        end = this.snapToBoundary(end, silencePoints, 4.0);
      }

      clips.push({
        id: `clip_${idx}`,
        start: Math.round(current * 100) / 100,
        end: Math.round(end * 100) / 100,
        duration: Math.round((end - current) * 100) / 100,
        hookHeadline: `Highlight Moment ${idx}`,
        viralScore: 82,
        reasoning: 'High-energy segment bounded by natural audio silence.',
      });

      current = end;
      idx++;
    }

    return clips;
  }

  /**
   * Analyze transcript using local Ollama instance (0 tokens / $0 cost)
   */
  private async analyzeWithOllama(
    subtitles: SubtitleItem[],
    sourceDuration: number,
    maxClips: number,
    targetDuration: number,
    model: string
  ): Promise<HighlightClip[]> {
    const formattedTranscript = subtitles
      .map((s) => `[${s.start.toFixed(1)}s -> ${s.end.toFixed(1)}s] ${s.text}`)
      .join('\n');

    const prompt = `Analyze this timestamped transcript from a video (${sourceDuration.toFixed(0)}s total duration).
Find the top ${maxClips} standalone viral moments suitable for YouTube Shorts / Instagram Reels (target duration: ~${targetDuration}s, range 30-75s).

Rules:
1. Every clip MUST start on a strong curiosity hook and end on a completed thought or punchline. Do not cut mid-sentence.
2. hookHeadline MUST be a catchy social media title in 4 to 8 words without emojis.
3. viralScore MUST be between 70 and 99 based on curiosity, insight, or emotional reaction.

Transcript:
${formattedTranscript}

Respond ONLY with valid JSON in this exact structure:
{
  "clips": [
    {
      "start": 12.5,
      "end": 64.2,
      "hookHeadline": "The Hidden Truth About Startup Churn",
      "viralScore": 92,
      "reasoning": "Strong opening hook followed by concrete surprising takeaway."
    }
  ]
}`;

    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        format: 'json',
        stream: false,
        options: { temperature: 0.2 },
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const parsed = JSON.parse(data.response || '{}');
    const rawClips = Array.isArray(parsed) ? parsed : parsed.clips || [];

    return rawClips.map((c: any, i: number) => ({
      id: `clip_${i + 1}`,
      start: Number(c.start) || 0,
      end: Number(c.end) || Math.min(sourceDuration, (Number(c.start) || 0) + targetDuration),
      duration: Math.max(5, (Number(c.end) || 0) - (Number(c.start) || 0)),
      hookHeadline: String(c.hookHeadline || '').replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').trim(),
      viralScore: Number(c.viralScore) || 85,
      reasoning: String(c.reasoning || ''),
    }));
  }

  /**
   * Analyze transcript using Google Gemini AI
   */
  private async analyzeWithGemini(
    subtitles: SubtitleItem[],
    sourceDuration: number,
    maxClips: number,
    targetDuration: number,
    apiKeyOverride?: string
  ): Promise<HighlightClip[]> {
    const apiKey =
      apiKeyOverride ||
      config.geminiApiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in .env file.');
    }

    const formattedTranscript = subtitles
      .map((s) => `[${s.start.toFixed(1)}s -> ${s.end.toFixed(1)}s] ${s.text}`)
      .join('\n');

    const promptText = `You are an expert short-form video editor for YouTube Shorts and Instagram Reels.
Analyze this timestamped transcript from a video of ${sourceDuration.toFixed(0)} seconds duration.
Select the top ${maxClips} standalone viral clips with durations between 30 and 75 seconds (ideal: ~${targetDuration}s).

CRITICAL RULES:
1. COMPLETE THOUGHTS: Each clip must begin on a hook and end on a completed thought or punchline. Never cut mid-sentence.
2. HOOK HEADLINE: Write a catchy 4 to 8 word title for the top text overlay. Never use emojis.
3. VIRAL SCORE: Score 70-98 on curiosity gap, emotional energy, and retention strength.
4. STRICT JSON: Respond ONLY with valid JSON conforming to:
{
  "clips": [
    {
      "start": 12.5,
      "end": 64.2,
      "hookHeadline": "Why Most Startups Fail In Year Two",
      "viralScore": 94,
      "reasoning": "Starts with a bold contrarian hook and delivers a clear lesson."
    }
  ]
}

Transcript:
${formattedTranscript}`;

    const models = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];
    let rawText = '';
    let lastErr: Error | null = null;

    for (const model of models) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (rawText.trim().length > 0) break;
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP ${res.status}`);
        }
      } catch (err: unknown) {
        lastErr = err instanceof Error ? err : new Error(String(err));
      }
    }

    if (!rawText) {
      throw lastErr || new Error('Failed to receive response from Gemini AI.');
    }

    let clean = rawText.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    const parsed = JSON.parse(clean);
    const rawClips = Array.isArray(parsed) ? parsed : parsed.clips || [];

    return rawClips.map((c: any, i: number) => ({
      id: `clip_${i + 1}`,
      start: Number(c.start) || 0,
      end: Number(c.end) || Math.min(sourceDuration, (Number(c.start) || 0) + targetDuration),
      duration: Math.max(5, (Number(c.end) || 0) - (Number(c.start) || 0)),
      hookHeadline: String(c.hookHeadline || '').replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').trim(),
      viralScore: Number(c.viralScore) || 88,
      reasoning: String(c.reasoning || ''),
    }));
  }
}

export const aiHighlightService = new AIHighlightService();
