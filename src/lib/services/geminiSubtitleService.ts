import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '../config';
import { logger } from '../logger/logger';
import { SubtitleItem } from '../../shared/schemas';

const execAsync = promisify(exec);

export class GeminiSubtitleService {
  /**
   * Formats seconds into standard SRT timestamp: HH:MM:SS,mmm
   */
  public formatSrtTimestamp(totalSeconds: number): string {
    const clamped = Math.max(0, totalSeconds);
    const hours = Math.floor(clamped / 3600);
    const minutes = Math.floor((clamped % 3600) / 60);
    const seconds = Math.floor(clamped % 60);
    const milliseconds = Math.floor((clamped - Math.floor(clamped)) * 1000);

    const pad = (n: number, z = 2) => String(n).padStart(z, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(milliseconds, 3)}`;
  }

  /**
   * Generates a cut, relative SRT subtitle file for a specific split part
   */
  public generatePartSrt(
    allSubtitles: SubtitleItem[],
    partStart: number,
    partEnd: number,
    outputPath: string
  ): boolean {
    if (!allSubtitles || allSubtitles.length === 0) return false;

    // Filter subtitles overlapping with this part
    const overlapping = allSubtitles.filter(
      (s) => s.end > partStart && s.start < partEnd && s.text.trim().length > 0
    );

    if (overlapping.length === 0) return false;

    let srtContent = '';
    let counter = 1;

    for (const sub of overlapping) {
      // Offset timestamps relative to the start of this part
      const relStart = Math.max(0, sub.start - partStart);
      const relEnd = Math.max(relStart + 0.3, Math.min(partEnd - partStart, sub.end - partStart));

      if (relEnd <= relStart) continue;

      const startTimestamp = this.formatSrtTimestamp(relStart);
      const endTimestamp = this.formatSrtTimestamp(relEnd);

      srtContent += `${counter}\n${startTimestamp} --> ${endTimestamp}\n${sub.text.trim()}\n\n`;
      counter++;
    }

    if (counter === 1) return false;

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, srtContent, 'utf-8');
    return true;
  }

  /**
   * Writes subtitles array directly to an SRT file
   */
  public writeSrtFile(subtitles: SubtitleItem[], outputPath: string): boolean {
    if (!subtitles || subtitles.length === 0) return false;

    let srtContent = '';
    let counter = 1;

    for (const sub of subtitles) {
      if (!sub.text || sub.text.trim().length === 0) continue;
      const startTimestamp = this.formatSrtTimestamp(sub.start);
      const endTimestamp = this.formatSrtTimestamp(sub.end);
      srtContent += `${counter}\n${startTimestamp} --> ${endTimestamp}\n${sub.text.trim()}\n\n`;
      counter++;
    }

    if (counter === 1) return false;

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, srtContent, 'utf-8');
    return true;
  }

  /**
   * Extracts compressed speech audio from a video using FFmpeg, optionally sliced for a single part
   */
  public async extractAudio(
    videoPath: string,
    outputPath: string,
    startSec?: number,
    durationSec?: number
  ): Promise<string> {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    // 16kHz mono 48kbps MP3 produces crisp voice transcription with minimal payload size
    const seekArg = startSec !== undefined && startSec >= 0 ? `-ss ${startSec}` : '';
    const durArg = durationSec !== undefined && durationSec > 0 ? `-t ${durationSec}` : '';
    const cmd = `"${config.ffmpegPath}" -y ${seekArg} ${durArg} -i "${videoPath}" -vn -ar 16000 -ac 1 -b:a 48k "${outputPath}"`;
    await execAsync(cmd);

    if (!fs.existsSync(outputPath)) {
      throw new Error(`Failed to extract audio stream from video.`);
    }

    return outputPath;
  }

  /**
   * Transcribes video audio using Google Gemini AI and returns timestamped subtitle segments
   */
  public async generateSubtitles(
    videoPath: string,
    apiKeyOverride?: string,
    startSec?: number,
    durationSec?: number
  ): Promise<SubtitleItem[]> {
    const apiKey =
      apiKeyOverride ||
      config.geminiApiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not configured. Please add GEMINI_API_KEY=your_key in your .env file.'
      );
    }

    const tempAudioPath = path.join(
      config.workDir,
      `temp_audio_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`
    );

    try {
      const sliceLabel =
        startSec !== undefined && durationSec !== undefined
          ? ` (${startSec}s - ${startSec + durationSec}s)`
          : '';
      logger.system(
        'info',
        'GEMINI_AUDIO_EXTRACT_START',
        `Extracting audio track${sliceLabel} for transcription from ${path.basename(videoPath)}`
      );
      await this.extractAudio(videoPath, tempAudioPath, startSec, durationSec);

      const audioBuffer = fs.readFileSync(tempAudioPath);
      const base64Audio = audioBuffer.toString('base64');
      const audioSizeMb = (audioBuffer.length / (1024 * 1024)).toFixed(2);

      logger.system(
        'info',
        'GEMINI_TRANSCRIBE_START',
        `Sending ${audioSizeMb} MB audio payload${sliceLabel} to Gemini AI for timestamped transcription`
      );

      const prompt = `Listen carefully to this audio and generate exact timestamped subtitles.
Transcribe all spoken words accurately.
Break the transcription into natural, short subtitle chunks (1 to 2 lines per subtitle, around 2 to 5 seconds each).
Return a valid JSON array of objects. Each object must have:
- "start": start timestamp in seconds as a float (e.g. 0.0, 3.25)
- "end": end timestamp in seconds as a float (e.g. 2.8, 6.1)
- "text": the transcribed spoken text for this timeframe

Ensure the subtitles are strictly chronological with realistic durations.
Respond ONLY with the JSON array in the format: [{"start": 0.0, "end": 2.5, "text": "..."}]`;

      // Supported modern Gemini models in order of capability
      const models = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];
      let rawResponseText = '';
      let lastError: Error | null = null;

      for (const model of models) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      inlineData: {
                        mimeType: 'audio/mp3',
                        data: base64Audio,
                      },
                    },
                    {
                      text: prompt,
                    },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.2,
              },
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const errMsg = errData.error?.message || `HTTP ${res.status}: ${res.statusText}`;
            throw new Error(`Gemini API error (${model}): ${errMsg}`);
          }

          const data = await res.json();
          rawResponseText =
            data.candidates?.[0]?.content?.parts?.[0]?.text || '';

          if (rawResponseText.trim().length > 0) {
            break; // Success!
          }
        } catch (mErr: unknown) {
          lastError = mErr instanceof Error ? mErr : new Error(String(mErr));
          logger.system('warn', 'GEMINI_MODEL_RETRY', `Model ${model} failed, attempting fallback: ${lastError.message}`);
        }
      }

      if (!rawResponseText) {
        throw lastError || new Error('Empty response received from Gemini API.');
      }

      // Parse JSON from Gemini output
      let cleanJson = rawResponseText.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      const parsed = JSON.parse(cleanJson);
      const rawItems: any[] = Array.isArray(parsed) ? parsed : parsed.subtitles || parsed.segments || [];

      const subtitles: SubtitleItem[] = rawItems
        .filter((item) => typeof item.text === 'string' && item.text.trim().length > 0)
        .map((item) => ({
          start: Math.max(0, Number(item.start) || 0),
          end: Math.max((Number(item.start) || 0) + 0.5, Number(item.end) || 0),
          text: String(item.text).trim(),
        }))
        .sort((a, b) => a.start - b.start);

      logger.system('info', 'GEMINI_TRANSCRIBE_SUCCESS', `Successfully generated ${subtitles.length} timestamped subtitle segments with Gemini AI`);
      return subtitles;
    } finally {
      if (fs.existsSync(tempAudioPath)) {
        try {
          fs.unlinkSync(tempAudioPath);
        } catch {}
      }
    }
  }
}

export const geminiSubtitleService = new GeminiSubtitleService();
