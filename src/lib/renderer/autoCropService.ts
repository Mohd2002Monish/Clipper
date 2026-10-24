import { spawn } from 'child_process';
import { config } from '../config';
import { logger } from '../logger/logger';

export interface TrajectoryPoint {
  timeSec: number;
  normX: number;
  cropX: number;
}

export class AutoCropService {
  /**
   * Sample a single video frame at timestampSec and calculate the horizontal centroid
   * of the primary human face/subject using YUV skin-chroma analysis.
   * Returns a normalized horizontal position from 0.0 (left) to 1.0 (right).
   */
  public async detectFrameSubjectCentroid(videoPath: string, timestampSec: number): Promise<number> {
    return new Promise((resolve) => {
      const width = 160;
      const height = 90;
      const ySize = width * height; // 14400 bytes
      const uvWidth = width / 2; // 80
      const uvHeight = height / 2; // 45
      const uvSize = uvWidth * uvHeight; // 3600 bytes
      const totalExpected = ySize + 2 * uvSize; // 21600 bytes

      const args = [
        '-y',
        '-ss',
        String(Math.max(0, timestampSec)),
        '-i',
        videoPath,
        '-vframes',
        '1',
        '-vf',
        `scale=${width}:${height}`,
        '-f',
        'rawvideo',
        '-pix_fmt',
        'yuv420p',
        'pipe:1',
      ];

      const child = spawn(config.ffmpegPath, args, { stdio: ['ignore', 'pipe', 'ignore'] });
      const chunks: Buffer[] = [];

      child.stdout.on('data', (chunk) => chunks.push(chunk));

      child.on('error', () => resolve(0.5));

      child.on('close', (code) => {
        if (code !== 0) {
          resolve(0.5);
          return;
        }

        const buf = Buffer.concat(chunks);
        if (buf.length < totalExpected) {
          resolve(0.5);
          return;
        }

        const uOffset = ySize;
        const vOffset = ySize + uvSize;

        // Weight columns based on human skin & upper-body face likelihood
        const colWeights = new Float64Array(uvWidth);
        let totalSkinWeight = 0;

        // Inspect rows in upper two-thirds (where heads and faces sit)
        const rowStart = Math.floor(uvHeight * 0.1);
        const rowEnd = Math.floor(uvHeight * 0.75);

        for (let r = rowStart; r < rowEnd; r++) {
          const uvRowOffset = r * uvWidth;
          const yRowOffset = r * 2 * width;

          for (let c = 0; c < uvWidth; c++) {
            const yVal = buf[yRowOffset + c * 2];
            const uVal = buf[uOffset + uvRowOffset + c]; // Cb
            const vVal = buf[vOffset + uvRowOffset + c]; // Cr

            // Human skin chrominance cluster in YUV color space:
            // Cb between 80 and 130, Cr between 133 and 178, reasonable luminance
            if (yVal > 35 && uVal >= 80 && uVal <= 130 && vVal >= 133 && vVal <= 178) {
              // Higher weight for central vertical bands (likely face region)
              const verticalFactor = 1.0 - Math.abs(r - uvHeight * 0.35) / (uvHeight * 0.5);
              const weight = Math.max(0.1, verticalFactor);
              colWeights[c] += weight;
              totalSkinWeight += weight;
            }
          }
        }

        if (totalSkinWeight < 10) {
          // If no face/skin detected, default to center
          resolve(0.5);
          return;
        }

        let weightedSum = 0;
        for (let c = 0; c < uvWidth; c++) {
          weightedSum += c * colWeights[c];
        }

        const centroidCol = weightedSum / totalSkinWeight;
        const normalizedX = Math.max(0.05, Math.min(0.95, centroidCol / uvWidth));
        resolve(normalizedX);
      });
    });
  }

  /**
   * Generates a smooth, cinema-grade dynamic crop expression for FFmpeg's `crop` filter.
   * Samples keyframes, smooths trajectory with EMA, and builds an eased piecewise expression.
   */
  public async buildAutoCropExpression(params: {
    videoPath: string;
    start: number;
    duration: number;
    inW: number;
    inH: number;
    targetW: number;
    targetH: number;
  }): Promise<string> {
    const { videoPath, start, duration, inW, targetW } = params;
    const maxOffset = inW - targetW;

    if (maxOffset <= 10) {
      // Virtually no horizontal excess to pan
      return `(in_w-${targetW})/2`;
    }

    // Determine sample timestamps across the clip
    const numSamples = Math.min(10, Math.max(3, Math.ceil(duration / 3.0)));
    const step = duration / Math.max(1, numSamples - 1);
    const sampleTimes: number[] = [];

    for (let i = 0; i < numSamples; i++) {
      sampleTimes.push(start + i * step);
    }

    // Run sparse face detections
    const rawPoints: TrajectoryPoint[] = [];
    for (const st of sampleTimes) {
      const normX = await this.detectFrameSubjectCentroid(videoPath, st);
      const rawCropX = Math.max(0, Math.min(maxOffset, Math.round(normX * inW - targetW / 2)));
      rawPoints.push({
        timeSec: st - start, // relative to clip start
        normX,
        cropX: rawCropX,
      });
    }

    // Smooth trajectory with Exponential Moving Average (EMA) and dead-band
    const smoothedPoints: TrajectoryPoint[] = [];
    let currentSmoothedX = rawPoints[0].cropX;
    const alpha = 0.35; // Responsive yet smooth camera glide
    const deadband = maxOffset * 0.04; // Don't move for tiny micro-twitches

    for (const pt of rawPoints) {
      const diff = pt.cropX - currentSmoothedX;
      if (Math.abs(diff) > deadband) {
        currentSmoothedX = Math.round(currentSmoothedX + alpha * diff);
      }
      currentSmoothedX = Math.max(0, Math.min(maxOffset, currentSmoothedX));
      smoothedPoints.push({
        timeSec: pt.timeSec,
        normX: pt.normX,
        cropX: currentSmoothedX,
      });
    }

    // Check if the camera barely moves throughout the clip
    const minX = Math.min(...smoothedPoints.map((p) => p.cropX));
    const maxX = Math.max(...smoothedPoints.map((p) => p.cropX));

    if (maxX - minX < 20) {
      // Stationary camera is sufficient
      return String(smoothedPoints[0].cropX);
    }

    // Construct nested piecewise cosine eased expression:
    // Ease-in/ease-out formula between (t1, X1) and (t2, X2):
    // X1 + (X2 - X1) * (1 - cos(PI * (t - t1) / (t2 - t1))) / 2
    let expr = String(smoothedPoints[smoothedPoints.length - 1].cropX);

    for (let i = smoothedPoints.length - 2; i >= 0; i--) {
      const p1 = smoothedPoints[i];
      const p2 = smoothedPoints[i + 1];
      const t1 = p1.timeSec.toFixed(2);
      const t2 = p2.timeSec.toFixed(2);
      const dt = Math.max(0.1, p2.timeSec - p1.timeSec).toFixed(2);
      const dx = p2.cropX - p1.cropX;

      let segmentFormula: string;
      if (dx === 0) {
        segmentFormula = String(p1.cropX);
      } else {
        segmentFormula = `${p1.cropX}+${dx}*(1-cos(PI*(t-${t1})/${dt}))/2`;
      }

      expr = `if(lt(t\\,${t2})\\,${segmentFormula}\\,${expr})`;
    }

    logger.render(
      'info',
      'AUTO_CROP_TRAJECTORY_BUILT',
      `Auto-face pan trajectory generated across ${smoothedPoints.length} points (X: ${minX}px -> ${maxX}px)`
    );

    return `min(max(0\\,${expr})\\,in_w-${targetW})`;
  }
}

export const autoCropService = new AutoCropService();
