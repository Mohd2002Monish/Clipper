import path from 'path';
import fs from 'fs';
import { calculateTargetDimensions } from './dimensions';
import { buildRenderRecipe, TextOverlayRenderConfig } from './filterBuilder';
import { ffmpegRunner } from './ffmpegRunner';
import { verifyService, VerificationResult } from './verifyService';
import { OutputFormatSettings, TextOverlaySettings, AISubtitleSettings } from '../../shared/schemas';
import { VideoProbeData } from '../../shared/types';
import { evaluateTextTokens, wrapTextForOverlay } from './textProcessor';
import { writeSafeTextFile } from './fontManager';
import { geminiSubtitleService } from '../services/geminiSubtitleService';
import { logger } from '../logger/logger';
import { config } from '../config';
import { autoCropService } from './autoCropService';

export interface RenderPartParams {
  jobId: string;
  partIndex: number;
  totalParts: number;
  start: number;
  duration: number;
  outputFilename: string;
  sourceFilePath: string;
  sourceProbe: VideoProbeData;
  outputFormat: OutputFormatSettings;
  textOverlay?: TextOverlaySettings;
  aiSubtitles?: AISubtitleSettings;
  partSrtPath?: string;
  onProgress?: (percent: number, fps: number, currentSec: number) => void;
}

export interface RenderPartOutput {
  outputPath: string;
  outputSize: number;
  verification: VerificationResult;
  elapsedMs: number;
}

export class PartRenderer {
  public async renderSinglePart(params: RenderPartParams): Promise<RenderPartOutput> {
    const {
      jobId,
      partIndex,
      totalParts,
      start,
      duration,
      outputFilename,
      sourceFilePath,
      sourceProbe,
      outputFormat,
      textOverlay,
      aiSubtitles,
      onProgress,
    } = params;

    const jobWorkDir = path.join(config.workDir, jobId);
    if (!fs.existsSync(jobWorkDir)) {
      fs.mkdirSync(jobWorkDir, { recursive: true });
    }

    const folderName = (outputFormat.folderName || 'General').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'General';
    const jobOutputDir = path.join(config.outputsDir, folderName, jobId);
    if (!fs.existsSync(jobOutputDir)) {
      fs.mkdirSync(jobOutputDir, { recursive: true });
    }

    const tempOutputPath = path.join(jobWorkDir, `temp_part_${partIndex}_${outputFilename}`);
    const finalOutputPath = path.join(jobOutputDir, outputFilename);

    // 1. Calculate target dimensions
    const targetDimensions = calculateTargetDimensions({
      aspectRatio: outputFormat.aspectRatio,
      customAspectRatio: outputFormat.customAspectRatio,
      resolution: outputFormat.resolution,
      sourceWidth: sourceProbe.displayWidth,
      sourceHeight: sourceProbe.displayHeight,
    });

    // 2. Prepare Safe Text Files
    const textRenderConfig: TextOverlayRenderConfig = {};
    const createdTextFiles: string[] = [];

    const tokenContext = {
      partIndex,
      totalParts,
      originalFilename: path.basename(sourceFilePath),
    };

    // Top text preparation
    if (textOverlay?.top?.enabled) {
      let rawTopText = textOverlay.top.text || '';
      if (textOverlay.top.mode === 'different') {
        const perPartArray = textOverlay.top.perPartTexts || [];
        rawTopText = perPartArray[partIndex - 1] ?? textOverlay.top.text ?? '';
      }

      const evaluatedTop = evaluateTextTokens(rawTopText, tokenContext);
      if (evaluatedTop.trim().length > 0) {
        const { wrappedText } = wrapTextForOverlay({
          text: evaluatedTop,
          videoWidth: targetDimensions.width,
          fontSize: textOverlay.top.fontSize || 36,
          maxLines: textOverlay.top.maxLines || 2,
        });

        const topFilePath = writeSafeTextFile({
          workDir: jobWorkDir,
          slot: 'top',
          partIndex,
          text: wrappedText,
        });

        textRenderConfig.topTextFilePath = topFilePath;
        textRenderConfig.topStyle = textOverlay.top;
        createdTextFiles.push(topFilePath);
      }
    }

    // Bottom text preparation
    if (textOverlay?.bottom?.enabled) {
      let rawBottomText = textOverlay.bottom.text || '';
      if (textOverlay.bottom.mode === 'different') {
        const perPartArray = textOverlay.bottom.perPartTexts || [];
        rawBottomText = perPartArray[partIndex - 1] ?? textOverlay.bottom.text ?? '';
      }

      const evaluatedBottom = evaluateTextTokens(rawBottomText, tokenContext);
      if (evaluatedBottom.trim().length > 0) {
        const { wrappedText } = wrapTextForOverlay({
          text: evaluatedBottom,
          videoWidth: targetDimensions.width,
          fontSize: textOverlay.bottom.fontSize || 36,
          maxLines: textOverlay.bottom.maxLines || 2,
        });

        const bottomFilePath = writeSafeTextFile({
          workDir: jobWorkDir,
          slot: 'bottom',
          partIndex,
          text: wrappedText,
        });

        textRenderConfig.bottomTextFilePath = bottomFilePath;
        textRenderConfig.bottomStyle = textOverlay.bottom;
        createdTextFiles.push(bottomFilePath);
      }
    }

    // Subtitles preparation
    if (aiSubtitles?.enabled) {
      let effectiveSrtPath = params.partSrtPath;
      if (!effectiveSrtPath && aiSubtitles.subtitles && aiSubtitles.subtitles.length > 0) {
        const srtPath = path.join(jobWorkDir, `part_${partIndex}_subtitles.srt`);
        const hasSubs = geminiSubtitleService.generatePartSrt(
          aiSubtitles.subtitles,
          start,
          start + duration,
          srtPath
        );
        if (hasSubs) {
          effectiveSrtPath = srtPath;
          createdTextFiles.push(srtPath);
        }
      }

      if (effectiveSrtPath && fs.existsSync(effectiveSrtPath)) {
        textRenderConfig.subtitleSrtFilePath = effectiveSrtPath;
        textRenderConfig.subtitleStyle = {
          fontSize: aiSubtitles.fontSize || 22,
          fontColor: aiSubtitles.fontColor || '#FFFFFF',
          outlineColor: aiSubtitles.outlineColor || '#000000',
          outlineWidth: aiSubtitles.outlineWidth || 2,
          marginV: aiSubtitles.marginV || 35,
        };
      }
    }

    // 3. Auto-Face Crop Pre-pass (Smart Pan & Scan)
    let dynamicCropExpr: string | undefined = undefined;
    if (outputFormat.reframeMode === 'crop' && outputFormat.focalPoint === 'auto_face') {
      try {
        const scaleFactor = Math.max(
          targetDimensions.width / sourceProbe.displayWidth,
          targetDimensions.height / sourceProbe.displayHeight
        );
        const inW = Math.round(sourceProbe.displayWidth * scaleFactor);
        const inH = Math.round(sourceProbe.displayHeight * scaleFactor);

        dynamicCropExpr = await autoCropService.buildAutoCropExpression({
          videoPath: sourceFilePath,
          start,
          duration,
          inW,
          inH,
          targetW: targetDimensions.width,
          targetH: targetDimensions.height,
        });
      } catch (cropErr: unknown) {
        logger.render(
          'warn',
          'AUTO_CROP_FAILED',
          `Auto-crop trajectory computation failed, falling back to center: ${cropErr}`,
          jobId,
          partIndex
        );
      }
    }

    // 4. Build Recipe
    const recipe = buildRenderRecipe({
      inputPath: sourceFilePath,
      outputPath: tempOutputPath,
      start,
      duration,
      targetDimensions,
      reframeMode: outputFormat.reframeMode,
      backgroundColor: outputFormat.backgroundColor,
      focalPoint: outputFormat.focalPoint,
      qualityPreset: outputFormat.qualityPreset,
      probe: sourceProbe,
      textOverlay: textRenderConfig,
      dynamicCropExpr,
    });

    const maxAttempts = 2;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          logger.render('warn', 'RENDER_RETRYING', `Retrying render for part ${partIndex} (attempt ${attempt}/${maxAttempts})`, jobId, partIndex);
          if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
        }

        // Execute FFmpeg
        const runner = ffmpegRunner.run({
          args: recipe.ffmpegArgs,
          jobId,
          partIndex,
          partDuration: duration,
          onProgress,
        });

        const runResult = await runner.promise;

        // Verify Output
        const verification = await verifyService.verifyOutput({
          outputPath: tempOutputPath,
          expectedDuration: duration,
          expectedWidth: targetDimensions.width,
          expectedHeight: targetDimensions.height,
          jobId,
          partIndex,
        });

        // Move verified file to outputs
        fs.renameSync(tempOutputPath, finalOutputPath);

        // Clean up temporary text files
        for (const tf of createdTextFiles) {
          if (fs.existsSync(tf)) {
            try {
              fs.unlinkSync(tf);
            } catch {
              // Ignore
            }
          }
        }

        return {
          outputPath: finalOutputPath,
          outputSize: verification.actualSizeBytes,
          verification,
          elapsedMs: runResult.elapsedMs,
        };
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (fs.existsSync(tempOutputPath)) {
          try {
            fs.unlinkSync(tempOutputPath);
          } catch {
            // Ignore
          }
        }
      }
    }

    // Cleanup text files on final failure
    for (const tf of createdTextFiles) {
      if (fs.existsSync(tf)) {
        try {
          fs.unlinkSync(tf);
        } catch {
          // Ignore
        }
      }
    }

    throw lastError || new Error(`Render failed for part ${partIndex} after ${maxAttempts} attempts.`);
  }
}

export const partRenderer = new PartRenderer();
