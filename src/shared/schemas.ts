import { z } from 'zod';

export const AspectRatioPresetSchema = z.enum(['9:16', '1:1', '4:5', '16:9', '4:3', 'custom']);
export type AspectRatioPreset = z.infer<typeof AspectRatioPresetSchema>;

export const ResolutionPresetSchema = z.enum(['1080p', '720p', 'original']);
export type ResolutionPreset = z.infer<typeof ResolutionPresetSchema>;

export const ReframeModeSchema = z.enum(['blur', 'solid', 'crop']);
export type ReframeMode = z.infer<typeof ReframeModeSchema>;

export const FocalPointSchema = z.enum(['left', 'center', 'right', 'auto_face', 'custom']);
export type FocalPoint = z.infer<typeof FocalPointSchema>;

export const SplitModeSchema = z.enum(['fixed', 'parts', 'custom', 'ai_highlights']);
export type SplitMode = z.infer<typeof SplitModeSchema>;

export const CustomTimestampRowSchema = z.object({
  id: z.string(),
  start: z.number().min(0),
  end: z.number().min(0),
});
export type CustomTimestampRow = z.infer<typeof CustomTimestampRowSchema>;

export const AIHighlightClipSchema = z.object({
  id: z.string(),
  start: z.number().min(0),
  end: z.number().min(0),
  hookHeadline: z.string().default(''),
  viralScore: z.number().min(0).max(100).default(80),
  reasoning: z.string().optional(),
});
export type AIHighlightClip = z.infer<typeof AIHighlightClipSchema>;

export const SplitSettingsSchema = z.object({
  mode: SplitModeSchema,
  fixedLengthSeconds: z.number().positive().default(60),
  numberOfParts: z.number().int().positive().default(5),
  customTimestamps: z.array(CustomTimestampRowSchema).default([]),
  aiClips: z.array(AIHighlightClipSchema).default([]),
  targetClipDurationSec: z.number().min(15).max(180).default(50),
  overlapSeconds: z.number().min(0).default(0),
  minLastPartSeconds: z.number().min(0).default(5),
  lastPartAction: z.enum(['merge', 'keep']).default('merge'),
  maxPartsLimit: z.number().int().positive().default(10000),
});
export type SplitSettings = z.infer<typeof SplitSettingsSchema>;

export const TextSlotSchema = z.object({
  enabled: z.boolean().default(false),
  mode: z.enum(['same', 'different']).default('same'),
  text: z.string().default(''),
  perPartTexts: z.array(z.string()).default([]),
  fontFamily: z.string().default('Noto Sans'),
  fontSize: z.number().min(8).max(120).default(36),
  fontColor: z.string().default('#FFFFFF'),
  outlineColor: z.string().default('#000000'),
  outlineWidth: z.number().min(0).max(20).default(3),
  bgBoxEnabled: z.boolean().default(false),
  bgBoxColor: z.string().default('#000000'),
  bgBoxOpacity: z.number().min(0).max(1).default(0.6),
  alignment: z.enum(['left', 'center', 'right']).default('center'),
  margin: z.number().min(0).max(300).default(40),
  maxLines: z.number().int().min(1).max(5).default(2),
  durationMode: z.enum(['full', 'firstN']).default('full'),
  durationSeconds: z.number().positive().default(5),
});
export type TextSlotConfig = z.infer<typeof TextSlotSchema>;

export const TextOverlaySettingsSchema = z.object({
  top: TextSlotSchema.default({
    enabled: false,
    mode: 'same',
    text: '',
    perPartTexts: [],
    fontFamily: 'Noto Sans',
    fontSize: 36,
    fontColor: '#FFFFFF',
    outlineColor: '#000000',
    outlineWidth: 3,
    bgBoxEnabled: false,
    bgBoxColor: '#000000',
    bgBoxOpacity: 0.6,
    alignment: 'center',
    margin: 40,
    maxLines: 2,
    durationMode: 'full',
    durationSeconds: 5,
  }),
  bottom: TextSlotSchema.default({
    enabled: false,
    mode: 'same',
    text: '',
    perPartTexts: [],
    fontFamily: 'Noto Sans',
    fontSize: 36,
    fontColor: '#FFFFFF',
    outlineColor: '#000000',
    outlineWidth: 3,
    bgBoxEnabled: false,
    bgBoxColor: '#000000',
    bgBoxOpacity: 0.6,
    alignment: 'center',
    margin: 40,
    maxLines: 2,
    durationMode: 'full',
    durationSeconds: 5,
  }),
  showSafeZoneGuide: z.boolean().default(false),
  themePreset: z.string().optional().default('tiktok-viral'),
});
export type TextOverlaySettings = z.infer<typeof TextOverlaySettingsSchema>;

export const OutputFormatSchema = z.object({
  aspectRatio: AspectRatioPresetSchema.default('9:16'),
  customAspectRatio: z.string().optional(), // e.g. "9:16"
  resolution: ResolutionPresetSchema.default('1080p'),
  reframeMode: ReframeModeSchema.default('blur'),
  backgroundColor: z.string().default('#000000'),
  focalPoint: FocalPointSchema.default('center'),
  focalPointCoords: z.object({ x: z.number(), y: z.number() }).optional(),
  filenameTemplate: z.string().default('{title}_part{nn}'),
  qualityPreset: z.enum(['fast', 'balanced', 'high']).default('balanced'),
  destination: z.enum(['drive', 'local']).default('local'),
  folderName: z.string().optional().default('General'),
  driveFolderId: z.string().optional(),
  createSubfolder: z.boolean().default(true),
  onConflict: z.enum(['rename', 'overwrite', 'skip']).default('rename'),
});
export type OutputFormatSettings = z.infer<typeof OutputFormatSchema>;

export const SubtitleItemSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string(),
});
export type SubtitleItem = z.infer<typeof SubtitleItemSchema>;

export const AISubtitleSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  subtitles: z.array(SubtitleItemSchema).default([]),
  fontSize: z.number().min(10).max(60).default(22),
  fontColor: z.string().default('#FFFFFF'),
  outlineColor: z.string().default('#000000'),
  outlineWidth: z.number().min(0).max(10).default(2),
  marginV: z.number().min(5).max(150).default(35),
});
export type AISubtitleSettings = z.infer<typeof AISubtitleSettingsSchema>;

export const JobCreateRequestSchema = z.object({
  sourceFileId: z.string().min(1),
  originalFilename: z.string().min(1),
  folderName: z.string().optional().default('General'),
  outputFormat: OutputFormatSchema,
  splitSettings: SplitSettingsSchema,
  textOverlay: TextOverlaySettingsSchema,
  aiSubtitles: AISubtitleSettingsSchema.optional().default({
    enabled: false,
    subtitles: [],
    fontSize: 22,
    fontColor: '#FFFFFF',
    outlineColor: '#000000',
    outlineWidth: 2,
    marginV: 35,
  }),
});
export type JobCreateRequest = z.infer<typeof JobCreateRequestSchema>;

export const PartPlanSchema = z.object({
  index: z.number().int().min(1),
  start: z.number().min(0),
  end: z.number().min(0),
  duration: z.number().positive(),
  filename: z.string(),
  topText: z.string().optional(),
  bottomText: z.string().optional(),
});
export type PartPlan = z.infer<typeof PartPlanSchema>;
