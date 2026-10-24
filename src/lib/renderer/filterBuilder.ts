import { execSync } from 'child_process';
import { ReframeMode, FocalPoint, TextSlotConfig } from '../../shared/schemas';
import { VideoProbeData } from '../../shared/types';
import { TargetDimensions } from './dimensions';
import { resolveFontFilePath } from './fontManager';
import { config } from '../config';

let cachedHwAccel: boolean | null = null;

export function isVideoToolboxAvailable(): boolean {
  if (cachedHwAccel !== null) return cachedHwAccel;
  if (process.platform !== 'darwin') {
    cachedHwAccel = false;
    return false;
  }
  if (process.env.DISABLE_VIDEOTOOLBOX === 'true' || process.env.DISABLE_VIDEOTOOLBOX === '1') {
    cachedHwAccel = false;
    return false;
  }
  try {
    const res = execSync(`"${config.ffmpegPath}" -encoders`, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 }).toString();
    cachedHwAccel = res.includes('h264_videotoolbox');
  } catch {
    cachedHwAccel = false;
  }
  return cachedHwAccel;
}

export interface SubtitleRenderStyle {
  fontSize?: number;
  fontColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
  marginV?: number;
}

export interface TextOverlayRenderConfig {
  topTextFilePath?: string;
  topStyle?: TextSlotConfig;
  bottomTextFilePath?: string;
  bottomStyle?: TextSlotConfig;
  subtitleSrtFilePath?: string;
  subtitleStyle?: SubtitleRenderStyle;
}

export interface RenderRecipeOptions {
  inputPath: string;
  outputPath: string;
  start: number;
  duration: number;
  targetDimensions: TargetDimensions;
  reframeMode: ReframeMode;
  backgroundColor?: string;
  focalPoint?: FocalPoint;
  qualityPreset?: 'fast' | 'balanced' | 'high';
  probe: VideoProbeData;
  textOverlay?: TextOverlayRenderConfig;
  dynamicCropExpr?: string;
}

export interface RenderRecipe {
  ffmpegArgs: string[];
  filterGraph: string;
  targetWidth: number;
  targetHeight: number;
}

function escapeFilePathForFfmpeg(filePath: string): string {
  // In FFmpeg filter parameters, backslashes, colons, and single quotes must be escaped
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

export function buildRenderRecipe(options: RenderRecipeOptions): RenderRecipe {
  const {
    inputPath,
    outputPath,
    start,
    duration,
    targetDimensions,
    reframeMode,
    backgroundColor = '#000000',
    focalPoint = 'center',
    qualityPreset = 'balanced',
    probe,
    textOverlay,
    dynamicCropExpr,
  } = options;

  const targetW = targetDimensions.width;
  const targetH = targetDimensions.height;

  // Determine if aspect ratios match closely (within 1% tolerance)
  const targetRatio = targetW / targetH;
  const sourceRatio = probe.displayWidth / probe.displayHeight;
  const isRatioIdentical = Math.abs(sourceRatio - targetRatio) < 0.01;

  // Build Filter Graph
  const filters: string[] = [];

  // Stage 1: Input Normalization (Orientation transpose & SAR)
  let normChain = '[0:v]';

  if (probe.rotation === 90) {
    filters.push(`${normChain}transpose=1[v_rot]`);
    normChain = '[v_rot]';
  } else if (probe.rotation === 180) {
    filters.push(`${normChain}transpose=1,transpose=1[v_rot]`);
    normChain = '[v_rot]';
  } else if (probe.rotation === 270) {
    filters.push(`${normChain}transpose=2[v_rot]`);
    normChain = '[v_rot]';
  }

  if (probe.sampleAspectRatio && probe.sampleAspectRatio !== '1:1') {
    filters.push(`${normChain}scale=iw*sar:ih,setsar=1[v_sar]`);
    normChain = '[v_sar]';
  }

  // Stage 2: Reframing
  let currentVideoOut = '[v_reframe]';

  if (isRatioIdentical) {
    filters.push(`${normChain}scale=${targetW}:${targetH}:flags=bicubic${currentVideoOut}`);
  } else if (reframeMode === 'blur') {
    // High-performance blur: downscale background first (160px width), blur at low-res, then upscale to target resolution with bilinear filter.
    // This reduces boxblur pixel processing by ~98% while producing an ultra-smooth, flicker-free background.
    const lowW = 160;
    const lowH = Math.max(2, Math.round((lowW * targetH) / targetW / 2) * 2);
    filters.push(`${normChain}split=2[fg_in][bg_in]`);
    filters.push(
      `[bg_in]scale=${lowW}:${lowH}:force_original_aspect_ratio=increase,crop=${lowW}:${lowH},boxblur=8:2,scale=${targetW}:${targetH}:flags=bilinear,eq=brightness=-0.05:contrast=0.95[bg]`
    );
    filters.push(`[fg_in]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease[fg]`);
    filters.push(`[bg][fg]overlay=(W-w)/2:(H-h)/2${currentVideoOut}`);
  } else if (reframeMode === 'solid') {
    const colorHex = backgroundColor.startsWith('#') ? backgroundColor : `#${backgroundColor}`;
    filters.push(
      `${normChain}scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:color=${colorHex}${currentVideoOut}`
    );
  } else if (reframeMode === 'crop') {
    filters.push(`${normChain}scale=${targetW}:${targetH}:force_original_aspect_ratio=increase[scaled]`);
    let cropX = `(in_w-${targetW})/2`;
    if (dynamicCropExpr) {
      cropX = dynamicCropExpr;
    } else if (focalPoint === 'left') {
      cropX = '0';
    } else if (focalPoint === 'right') {
      cropX = `in_w-${targetW}`;
    }
    filters.push(`[scaled]crop=${targetW}:${targetH}:${cropX}:(in_h-${targetH})/2${currentVideoOut}`);
  }

  // Stage 3: Text Overlays (TOP & BOTTOM)
  let textChainIn = currentVideoOut;
  let textFilterCount = 0;

  // Top Text Slot
  if (textOverlay?.topTextFilePath && textOverlay.topStyle?.enabled) {
    const style = textOverlay.topStyle;
    const fontFile = resolveFontFilePath(style.fontFamily);
    const escapedFile = escapeFilePathForFfmpeg(textOverlay.topTextFilePath);

    const drawParts: string[] = [`textfile='${escapedFile}'`, 'expansion=none'];

    if (fontFile) {
      drawParts.push(`fontfile='${escapeFilePathForFfmpeg(fontFile)}'`);
    } else {
      drawParts.push(`font='${style.fontFamily || 'sans-serif'}'`);
    }

    drawParts.push(`fontsize=${style.fontSize || 36}`);
    drawParts.push(`fontcolor=${style.fontColor || '#FFFFFF'}`);

    if (style.outlineWidth && style.outlineWidth > 0) {
      drawParts.push(`borderw=${style.outlineWidth}`);
      drawParts.push(`bordercolor=${style.outlineColor || '#000000'}`);
    }

    if (style.bgBoxEnabled) {
      const boxColor = style.bgBoxColor || '#000000';
      const opacity = style.bgBoxOpacity ?? 0.6;
      drawParts.push(`box=1:boxcolor=${boxColor}@${opacity}:boxborderw=10`);
    }

    // X Alignment
    const margin = style.margin ?? 40;
    if (style.alignment === 'left') {
      drawParts.push(`x=${margin}`);
    } else if (style.alignment === 'right') {
      drawParts.push(`x=w-text_w-${margin}`);
    } else {
      drawParts.push('x=(w-text_w)/2');
    }

    // Y Position (Top)
    drawParts.push(`y=${margin}`);

    // Timing
    if (style.durationMode === 'firstN' && style.durationSeconds) {
      drawParts.push(`enable='between(t,0,${style.durationSeconds})'`);
    }

    const nextChainOut = `[v_top_text]`;
    filters.push(`${textChainIn}drawtext=${drawParts.join(':')}${nextChainOut}`);
    textChainIn = nextChainOut;
    textFilterCount++;
  }

  // Bottom Text Slot
  if (textOverlay?.bottomTextFilePath && textOverlay.bottomStyle?.enabled) {
    const style = textOverlay.bottomStyle;
    const fontFile = resolveFontFilePath(style.fontFamily);
    const escapedFile = escapeFilePathForFfmpeg(textOverlay.bottomTextFilePath);

    const drawParts: string[] = [`textfile='${escapedFile}'`, 'expansion=none'];

    if (fontFile) {
      drawParts.push(`fontfile='${escapeFilePathForFfmpeg(fontFile)}'`);
    } else {
      drawParts.push(`font='${style.fontFamily || 'sans-serif'}'`);
    }

    drawParts.push(`fontsize=${style.fontSize || 36}`);
    drawParts.push(`fontcolor=${style.fontColor || '#FFFFFF'}`);

    if (style.outlineWidth && style.outlineWidth > 0) {
      drawParts.push(`borderw=${style.outlineWidth}`);
      drawParts.push(`bordercolor=${style.outlineColor || '#000000'}`);
    }

    if (style.bgBoxEnabled) {
      const boxColor = style.bgBoxColor || '#000000';
      const opacity = style.bgBoxOpacity ?? 0.6;
      drawParts.push(`box=1:boxcolor=${boxColor}@${opacity}:boxborderw=10`);
    }

    const margin = style.margin ?? 40;
    if (style.alignment === 'left') {
      drawParts.push(`x=${margin}`);
    } else if (style.alignment === 'right') {
      drawParts.push(`x=w-text_w-${margin}`);
    } else {
      drawParts.push('x=(w-text_w)/2');
    }

    // Y Position (Bottom)
    drawParts.push(`y=h-text_h-${margin}`);

    if (style.durationMode === 'firstN' && style.durationSeconds) {
      drawParts.push(`enable='between(t,0,${style.durationSeconds})'`);
    }

    const nextChainOut = `[v_bottom_text]`;
    filters.push(`${textChainIn}drawtext=${drawParts.join(':')}${nextChainOut}`);
    textChainIn = nextChainOut;
    textFilterCount++;
  }

  // Stage 4: Subtitles (rendered at bottom center)
  if (textOverlay?.subtitleSrtFilePath) {
    const escapedSrt = escapeFilePathForFfmpeg(textOverlay.subtitleSrtFilePath);
    const subStyle = textOverlay.subtitleStyle || {};
    const fontSize = subStyle.fontSize || 22;
    const marginV = subStyle.marginV || 35;
    const outlineWidth = subStyle.outlineWidth !== undefined ? subStyle.outlineWidth : 2;
    const forceStyle = `force_style='Alignment=2,FontSize=${fontSize},MarginV=${marginV},BorderStyle=3,Outline=${outlineWidth}'`;
    const nextChainOut = `[v_subtitles]`;
    filters.push(`${textChainIn}subtitles='${escapedSrt}':${forceStyle}${nextChainOut}`);
    textChainIn = nextChainOut;
    textFilterCount++;
  }

  // Final mapping tag is the last chain output
  const finalVideoTag = textFilterCount > 0 ? textChainIn : currentVideoOut;

  // If final video tag is not [vout], append renaming or adjust filter graph
  let filterGraph = filters.join(';');
  // Replace final tag with [vout]
  filterGraph = filterGraph.substring(0, filterGraph.lastIndexOf(finalVideoTag)) + '[vout]';

  const ffmpegArgs: string[] = [
    '-y',
    '-ss',
    String(start),
    '-t',
    String(duration),
    '-i',
    inputPath,
    '-filter_complex',
    filterGraph,
    '-map',
    '[vout]',
  ];

  if (probe.hasAudio) {
    ffmpegArgs.push('-map', '0:a:0?');
    ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
  } else {
    ffmpegArgs.push('-an');
  }

  const useHardware = isVideoToolboxAvailable();

  if (useHardware) {
    let bitrate = '5000k';
    let qv = '65';
    if (qualityPreset === 'fast') {
      bitrate = '3500k';
      qv = '55';
    } else if (qualityPreset === 'high') {
      bitrate = '8000k';
      qv = '75';
    }

    ffmpegArgs.push(
      '-c:v',
      'h264_videotoolbox',
      '-b:v',
      bitrate,
      '-q:v',
      qv,
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-progress',
      'pipe:1',
      outputPath
    );
  } else {
    // Software encoder with optimized speed presets (veryfast / fast / faster instead of slow/medium)
    let presetFlag = 'fast';
    let crfVal = '20';

    if (qualityPreset === 'fast') {
      presetFlag = 'veryfast';
      crfVal = '22';
    } else if (qualityPreset === 'high') {
      presetFlag = 'faster';
      crfVal = '18';
    }

    ffmpegArgs.push(
      '-c:v',
      'libx264',
      '-preset',
      presetFlag,
      '-crf',
      crfVal,
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-progress',
      'pipe:1',
      outputPath
    );
  }

  return {
    ffmpegArgs,
    filterGraph,
    targetWidth: targetW,
    targetHeight: targetH,
  };
}
