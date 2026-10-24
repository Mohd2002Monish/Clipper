import path from 'path';
import { SplitSettings, PartPlan, CustomTimestampRow } from '../../shared/schemas';
import { logger } from '../logger/logger';
import { config } from '../config';

export interface PlanResult {
  plan: PartPlan[];
  warnings: string[];
  totalParts: number;
  totalDuration: number;
  adjustments: string[];
}

export class PlannerService {
  /**
   * Format floating point seconds to clean 3-decimal precision (milliseconds)
   */
  public roundTime(val: number): number {
    return Math.round(val * 1000) / 1000;
  }

  /**
   * Format seconds to HH:MM:SS.mmm or MM:SS for user-friendly display
   */
  public formatTime(seconds: number): string {
    const s = Math.max(0, seconds);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    const wholeSecs = Math.floor(secs);
    const ms = Math.round((secs - wholeSecs) * 1000);
    return `${String(mins).padStart(2, '0')}:${String(wholeSecs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }

  /**
   * Generate output filename based on template (default: {title}_part{nn})
   */
  public generateFilename(
    template: string,
    originalFilename: string,
    partIndex: number,
    totalParts: number
  ): string {
    const parsed = path.parse(originalFilename);
    const rawTitle = parsed.name
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, '_')
      .trim() || 'video';

    const partNum2Digits = String(partIndex).padStart(2, '0');
    const partNum3Digits = String(partIndex).padStart(3, '0');
    const total2Digits = String(totalParts).padStart(2, '0');

    let result = template || '{title}_part{nn}';
    result = result.replace(/\{title\}/gi, rawTitle);
    result = result.replace(/\{nnn\}/gi, partNum3Digits);
    result = result.replace(/\{nn\}/gi, partNum2Digits);
    result = result.replace(/\{part\}/gi, String(partIndex));
    result = result.replace(/\{total\}/gi, String(totalParts));
    result = result.replace(/\{total_nn\}/gi, total2Digits);

    // Ensure .mp4 extension
    if (!result.toLowerCase().endsWith('.mp4')) {
      result += '.mp4';
    }

    return result;
  }

  /**
   * Main split plan computation engine
   */
  public computePlan(params: {
    sourceDuration: number;
    originalFilename: string;
    splitSettings: SplitSettings;
    filenameTemplate?: string;
    jobId?: string;
  }): PlanResult {
    const { sourceDuration, originalFilename, splitSettings } = params;
    const template = params.filenameTemplate || '{title}_part{nn}';
    const warnings: string[] = [];
    const adjustments: string[] = [];

    if (sourceDuration <= 0) {
      throw new Error(`Invalid source duration: ${sourceDuration}s. Video must be longer than 0 seconds.`);
    }

    const maxParts = splitSettings.maxPartsLimit || config.maxPartsLimit || 10000;

    const rawParts: Array<{ start: number; end: number; topText?: string }> = [];

    // --- MODE 1: FIXED DURATION ---
    if (splitSettings.mode === 'fixed') {
      const partLen = splitSettings.fixedLengthSeconds;
      const overlap = splitSettings.overlapSeconds || 0;
      const minLastPart = splitSettings.minLastPartSeconds ?? 5;
      const lastPartAction = splitSettings.lastPartAction || 'merge';

      if (partLen <= 0) {
        throw new Error('Fixed part length must be greater than 0 seconds.');
      }

      if (overlap >= partLen) {
        throw new Error(`Overlap (${overlap}s) must be smaller than part length (${partLen}s).`);
      }

      // If video duration is shorter than one part
      if (sourceDuration <= partLen) {
        rawParts.push({ start: 0, end: sourceDuration });
        warnings.push(`Source video duration (${sourceDuration}s) is shorter than part length (${partLen}s). Outputting 1 part.`);
      } else {
        const step = partLen - overlap;
        let currentStart = 0;

        while (currentStart < sourceDuration) {
          const currentEnd = Math.min(this.roundTime(currentStart + partLen), sourceDuration);
          const duration = this.roundTime(currentEnd - currentStart);

          // Check if this is the final slice
          const isLastSlice = currentEnd >= sourceDuration;

          if (isLastSlice && rawParts.length > 0 && duration < minLastPart) {
            if (lastPartAction === 'merge') {
              // Merge into previous part
              const prev = rawParts[rawParts.length - 1];
              prev.end = sourceDuration;
              adjustments.push(
                `Last part was ${duration}s (< min ${minLastPart}s) and was merged into Part ${rawParts.length}.`
              );
              break;
            } else {
              // Keep as short part
              rawParts.push({ start: currentStart, end: currentEnd });
              warnings.push(`Final part is ${duration}s (shorter than ${minLastPart}s), kept per configuration.`);
              break;
            }
          } else {
            rawParts.push({ start: currentStart, end: currentEnd });
            if (isLastSlice) break;
            currentStart = this.roundTime(currentStart + step);
          }

          if (rawParts.length > maxParts) {
            throw new Error(`Split plan exceeds maximum safety limit of ${maxParts} parts.`);
          }
        }
      }
    }

    // --- MODE 2: NUMBER OF PARTS ---
    else if (splitSettings.mode === 'parts') {
      const count = splitSettings.numberOfParts;
      const overlap = splitSettings.overlapSeconds || 0;

      if (!count || count < 1) {
        throw new Error('Number of parts must be at least 1.');
      }

      if (count > maxParts) {
        throw new Error(`Requested ${count} parts exceeds safety limit of ${maxParts}.`);
      }

      const baseDuration = sourceDuration / count;
      if (baseDuration < 0.5) {
        throw new Error(
          `Cannot divide ${sourceDuration}s video into ${count} parts (parts would be under 0.5s each).`
        );
      }

      if (overlap >= baseDuration) {
        throw new Error(`Overlap (${overlap}s) must be smaller than average part duration (${this.roundTime(baseDuration)}s).`);
      }

      let currentStart = 0;
      for (let i = 0; i < count; i++) {
        const isLast = i === count - 1;
        const currentEnd = isLast ? sourceDuration : this.roundTime(currentStart + baseDuration);
        rawParts.push({
          start: this.roundTime(currentStart),
          end: this.roundTime(currentEnd),
        });
        currentStart = this.roundTime(currentEnd - overlap);
      }
    }

    // --- MODE 3: CUSTOM TIMESTAMPS ---
    else if (splitSettings.mode === 'custom') {
      const rows = splitSettings.customTimestamps || [];
      if (rows.length === 0) {
        throw new Error('Custom split mode requires at least one timestamp row.');
      }

      if (rows.length > maxParts) {
        throw new Error(`Custom timestamps count (${rows.length}) exceeds safety limit of ${maxParts}.`);
      }

      rows.forEach((row: CustomTimestampRow, idx: number) => {
        const rowNum = idx + 1;
        if (typeof row.start !== 'number' || typeof row.end !== 'number' || isNaN(row.start) || isNaN(row.end)) {
          throw new Error(`Row ${rowNum}: Start and End must be valid numeric timestamps.`);
        }
        if (row.start < 0) {
          throw new Error(`Row ${rowNum}: Start timestamp cannot be negative (${row.start}s).`);
        }
        if (row.end <= row.start) {
          throw new Error(`Row ${rowNum}: End time (${row.end}s) must be greater than Start time (${row.start}s).`);
        }
        if (row.end > sourceDuration + 0.1) {
          throw new Error(`Row ${rowNum}: End time (${row.end}s) exceeds video duration (${sourceDuration}s).`);
        }

        const clampedEnd = Math.min(row.end, sourceDuration);
        rawParts.push({
          start: this.roundTime(row.start),
          end: this.roundTime(clampedEnd),
        });
      });
    }

    // --- MODE 4: AI VIRAL HIGHLIGHTS ---
    else if (splitSettings.mode === 'ai_highlights') {
      const clips = splitSettings.aiClips || [];
      if (clips.length === 0) {
        throw new Error('AI Highlights mode requires at least one detected highlight clip.');
      }

      clips.forEach((clip) => {
        const clampedStart = Math.max(0, clip.start);
        const clampedEnd = Math.min(clip.end, sourceDuration);
        if (clampedEnd > clampedStart) {
          rawParts.push({
            start: this.roundTime(clampedStart),
            end: this.roundTime(clampedEnd),
            topText: clip.hookHeadline || undefined,
          });
        }
      });
    }

    const totalParts = rawParts.length;
    const plan: PartPlan[] = rawParts.map((p, idx) => {
      const partIndex = idx + 1;
      const start = this.roundTime(p.start);
      const end = this.roundTime(p.end);
      const duration = this.roundTime(end - start);
      const filename = this.generateFilename(template, originalFilename, partIndex, totalParts);

      return {
        index: partIndex,
        start,
        end,
        duration,
        filename,
        topText: (p as any).topText,
      };
    });

    // Log the plan to logs/plan.log
    logger.plan('info', 'PLAN_COMPUTED', `Computed split plan: ${plan.length} parts for "${originalFilename}" (${sourceDuration}s)`, params.jobId, {
      totalParts: plan.length,
      mode: splitSettings.mode,
      adjustments,
      warnings,
      planSummary: plan.map((p) => ({
        index: p.index,
        time: `${this.formatTime(p.start)} -> ${this.formatTime(p.end)} (${p.duration}s)`,
        filename: p.filename,
      })),
    });

    return {
      plan,
      warnings,
      adjustments,
      totalParts: plan.length,
      totalDuration: sourceDuration,
    };
  }
}

export const plannerService = new PlannerService();
