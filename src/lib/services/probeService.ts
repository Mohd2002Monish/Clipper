import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { config } from '../config';
import { logger } from '../logger/logger';
import { VideoProbeData } from '../../shared/types';

const execFileAsync = promisify(execFile);

interface FFprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  sample_aspect_ratio?: string;
  display_aspect_ratio?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  duration?: string;
  bit_rate?: string;
  channels?: number;
  color_space?: string;
  color_transfer?: string;
  color_primaries?: string;
  tags?: Record<string, string>;
  side_data_list?: Array<{
    side_data_type?: string;
    rotation?: number;
  }>;
}

interface FFprobeFormat {
  duration?: string;
  size?: string;
  bit_rate?: string;
  format_name?: string;
  tags?: Record<string, string>;
}

interface FFprobeOutput {
  streams?: FFprobeStream[];
  format?: FFprobeFormat;
}

export class ProbeService {
  private ffprobePath: string;

  constructor() {
    this.ffprobePath = config.ffprobePath;
  }

  public async probeVideo(filePath: string, jobId?: string): Promise<VideoProbeData> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Video file not found at: ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      throw new Error('Video file is 0 bytes (corrupted or empty).');
    }

    const args = [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ];

    let stdout: string;
    try {
      const res = await execFileAsync(this.ffprobePath, args, { maxBuffer: 10 * 1024 * 1024 });
      stdout = res.stdout;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.probe('error', 'PROBE_FAILED', `FFprobe execution failed: ${errorMsg}`, jobId, {
        filePath,
        error: errorMsg,
      });
      throw new Error(`FFprobe failed to inspect media: ${errorMsg}`);
    }

    let parsed: FFprobeOutput;
    try {
      parsed = JSON.parse(stdout);
    } catch (err) {
      throw new Error('Failed to parse FFprobe JSON output.');
    }

    const streams = parsed.streams || [];
    const videoStream = streams.find((s) => s.codec_type === 'video');
    const audioStream = streams.find((s) => s.codec_type === 'audio');
    const format = parsed.format || {};

    if (!videoStream) {
      throw new Error('No valid video stream detected in the uploaded file.');
    }

    // 1. Raw Dimensions
    const rawWidth = videoStream.width || 1920;
    const rawHeight = videoStream.height || 1080;

    // 2. Rotation Detection
    // Rotation can be in tags.rotate, side_data_list.rotation, or TAG:rotate
    let rotation = 0;
    if (videoStream.tags?.rotate) {
      rotation = parseInt(videoStream.tags.rotate, 10) || 0;
    } else if (videoStream.side_data_list) {
      for (const sd of videoStream.side_data_list) {
        if (sd.rotation !== undefined) {
          rotation = Math.abs(sd.rotation);
          break;
        }
      }
    }

    // Normalize rotation to 0, 90, 180, 270
    rotation = ((rotation % 360) + 360) % 360;

    // 3. Sample Aspect Ratio (SAR) & Display Aspect Ratio (DAR)
    const sarString = videoStream.sample_aspect_ratio || '1:1';
    let sarRatio = 1.0;
    if (sarString && sarString.includes(':')) {
      const [num, den] = sarString.split(':').map((v) => parseFloat(v));
      if (num && den && den !== 0) {
        sarRatio = num / den;
      }
    }

    // Normalized display dimensions accounting for SAR
    let displayWidth = Math.round(rawWidth * sarRatio);
    let displayHeight = rawHeight;

    // Apply rotation swap: 90° or 270° orientation reverses width & height
    if (rotation === 90 || rotation === 270) {
      const temp = displayWidth;
      displayWidth = displayHeight;
      displayHeight = temp;
    }

    // Ensure even dimensions (required for H.264 encode)
    if (displayWidth % 2 !== 0) displayWidth += 1;
    if (displayHeight % 2 !== 0) displayHeight += 1;

    // 4. Duration
    let duration = 0;
    if (videoStream.duration) {
      duration = parseFloat(videoStream.duration);
    } else if (format.duration) {
      duration = parseFloat(format.duration);
    }

    // 5. FPS & Variable Frame Rate (VFR) Detection
    let fps = 30.0;
    let isVFR = false;

    const parseRate = (rateStr?: string) => {
      if (!rateStr || !rateStr.includes('/')) return 0;
      const [num, den] = rateStr.split('/').map(Number);
      return den ? num / den : 0;
    };

    const rFps = parseRate(videoStream.r_frame_rate);
    const avgFps = parseRate(videoStream.avg_frame_rate);

    if (avgFps > 0) {
      fps = Math.round(avgFps * 100) / 100;
    } else if (rFps > 0) {
      fps = Math.round(rFps * 100) / 100;
    }

    // If nominal r_frame_rate differs significantly from avg_frame_rate, flag as VFR
    if (rFps > 0 && avgFps > 0 && Math.abs(rFps - avgFps) > 0.5) {
      isVFR = true;
    }

    // 6. Audio stream metadata
    const hasAudio = Boolean(audioStream);
    const audioCodec = audioStream?.codec_name;
    const audioChannels = audioStream?.channels;

    // 7. HDR Detection
    const colorTransfer = videoStream.color_transfer || '';
    const colorPrimaries = videoStream.color_primaries || '';
    const isHDR =
      colorTransfer.includes('smpte2084') ||
      colorTransfer.includes('arib-std-b67') ||
      colorPrimaries.includes('bt2020');

    // 8. Bitrate
    const bitrate = format.bit_rate
      ? parseInt(format.bit_rate, 10)
      : videoStream.bit_rate
      ? parseInt(videoStream.bit_rate, 10)
      : undefined;

    const normalizedData: VideoProbeData = {
      duration: Math.max(0, Math.round(duration * 100) / 100),
      width: rawWidth,
      height: rawHeight,
      displayWidth,
      displayHeight,
      rotation,
      sampleAspectRatio: sarString,
      displayAspectRatio: `${displayWidth}:${displayHeight}`,
      fps,
      isVFR,
      videoCodec: videoStream.codec_name || 'unknown',
      audioCodec,
      hasAudio,
      audioChannels,
      bitrate,
      sizeBytes: stat.size,
      colorSpace: videoStream.color_space,
      isHDR,
      raw: parsed as unknown as Record<string, unknown>,
    };

    // Log complete facts to probe.log
    logger.probe('info', 'PROBE_SUCCESS', `Probed ${filePath}: ${displayWidth}x${displayHeight} (${fps}fps, rot: ${rotation}°, dur: ${duration}s)`, jobId, {
      normalized: {
        rawDimensions: `${rawWidth}x${rawHeight}`,
        displayDimensions: `${displayWidth}x${displayHeight}`,
        rotation,
        sar: sarString,
        fps,
        isVFR,
        hasAudio,
        audioCodec,
        duration,
        isHDR,
      },
    });

    return normalizedData;
  }
}

export const probeService = new ProbeService();
