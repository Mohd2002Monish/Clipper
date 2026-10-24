import { AspectRatioPreset, ResolutionPreset } from '../../shared/schemas';

export interface TargetDimensions {
  width: number;
  height: number;
  aspectRatioLabel: string;
}

/**
 * Calculates even target width and height based on aspect ratio preset and resolution class.
 * H.264 libx264 requires dimensions to be divisible by 2.
 */
export function calculateTargetDimensions(params: {
  aspectRatio: AspectRatioPreset;
  customAspectRatio?: string; // e.g. "9:16" or "1080:1920"
  resolution: ResolutionPreset;
  sourceWidth?: number;
  sourceHeight?: number;
}): TargetDimensions {
  const { aspectRatio, customAspectRatio, resolution, sourceWidth = 1920, sourceHeight = 1080 } = params;

  let baseWidth = 1080;
  let baseHeight = 1920;
  let label = '9:16';

  // Determine base aspect ratio ratios
  switch (aspectRatio) {
    case '9:16':
      label = '9:16';
      if (resolution === '720p') {
        baseWidth = 720;
        baseHeight = 1280;
      } else {
        baseWidth = 1080;
        baseHeight = 1920;
      }
      break;

    case '1:1':
      label = '1:1';
      if (resolution === '720p') {
        baseWidth = 720;
        baseHeight = 720;
      } else {
        baseWidth = 1080;
        baseHeight = 1080;
      }
      break;

    case '4:5':
      label = '4:5';
      if (resolution === '720p') {
        baseWidth = 720;
        baseHeight = 900;
      } else {
        baseWidth = 1080;
        baseHeight = 1350;
      }
      break;

    case '16:9':
      label = '16:9';
      if (resolution === '720p') {
        baseWidth = 1280;
        baseHeight = 720;
      } else {
        baseWidth = 1920;
        baseHeight = 1080;
      }
      break;

    case '4:3':
      label = '4:3';
      if (resolution === '720p') {
        baseWidth = 960;
        baseHeight = 720;
      } else {
        baseWidth = 1440;
        baseHeight = 1080;
      }
      break;

    case 'custom':
      label = customAspectRatio || '9:16';
      if (customAspectRatio && customAspectRatio.includes(':')) {
        const [w, h] = customAspectRatio.split(':').map(Number);
        if (w && h) {
          const ratio = w / h;
          if (resolution === '720p') {
            baseHeight = 720;
            baseWidth = Math.round(720 * ratio);
          } else {
            baseHeight = 1920;
            baseWidth = Math.round(1920 * ratio);
          }
        }
      }
      break;
  }

  // If resolution is 'original', adapt while preserving aspect ratio
  if (resolution === 'original' && sourceWidth && sourceHeight) {
    const targetRatio = baseWidth / baseHeight;
    const sourceRatio = sourceWidth / sourceHeight;

    if (sourceRatio > targetRatio) {
      // Source is wider, fix height
      baseHeight = sourceHeight;
      baseWidth = Math.round(sourceHeight * targetRatio);
    } else {
      // Source is taller, fix width
      baseWidth = sourceWidth;
      baseHeight = Math.round(sourceWidth / targetRatio);
    }
  }

  // Ensure even dimensions (divisible by 2)
  const width = Math.floor(baseWidth / 2) * 2;
  const height = Math.floor(baseHeight / 2) * 2;

  return {
    width,
    height,
    aspectRatioLabel: label,
  };
}
