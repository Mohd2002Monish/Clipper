'use client';

import React, { useState, useEffect } from 'react';
import {
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Clock,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Copy,
  Info,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Mic,
  Trash2,
  Sliders,
  Palette,
  BookmarkPlus,
  Check,
  X,
  Plus
} from 'lucide-react';
import { TextOverlaySettings, TextSlotConfig, AISubtitleSettings, SubtitleItem } from '@/shared/schemas';
import { SUPPORTED_FONTS } from '@/shared/constants';
import { CustomSelect } from './ui/CustomSelect';
import { THEME_PRESETS, applyThemeToSettings } from '@/shared/themes';
import { IThemePreset } from '@/shared/types';

interface TextOverlayEditorProps {
  settings: TextOverlaySettings;
  onChange: (newSettings: TextOverlaySettings) => void;
  partCount: number;
  originalFilename?: string;
  sanitizedFilename?: string;
  aiSubtitles?: AISubtitleSettings;
  onAiSubtitlesChange?: (newSubtitles: AISubtitleSettings) => void;
  uploadedVideoId?: string;
}

export function TextOverlayEditor({
  settings,
  onChange,
  partCount,
  originalFilename = 'my_video.mp4',
  sanitizedFilename,
  aiSubtitles,
  onAiSubtitlesChange,
  uploadedVideoId,
}: TextOverlayEditorProps) {
  const [activeSlot, setActiveSlot] = useState<'top' | 'bottom' | 'subtitles'>('top');
  const [pasteModalSlot, setPasteModalSlot] = useState<'top' | 'bottom' | null>(null);
  const [multilineInput, setMultilineInput] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [transcribeSuccess, setTranscribeSuccess] = useState<string | null>(null);

  // Theme presets & Custom theme states
  const [availableThemes, setAvailableThemes] = useState<IThemePreset[]>(THEME_PRESETS);
  const [showSaveThemeModal, setShowSaveThemeModal] = useState(false);
  const [customThemeName, setCustomThemeName] = useState('');
  const [customThemeDesc, setCustomThemeDesc] = useState('');
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [themeSaveMessage, setThemeSaveMessage] = useState<string | null>(null);

  const fetchThemes = async () => {
    try {
      const res = await fetch('/api/themes');
      if (res.ok) {
        const data = await res.json();
        if (data.themes && Array.isArray(data.themes)) {
          setAvailableThemes(data.themes);
        }
      }
    } catch {
      // Fallback to local constants
    }
  };

  useEffect(() => {
    fetchThemes();
  }, []);

  const handleSelectTheme = (theme: IThemePreset) => {
    if (theme.id === 'custom') {
      onChange({
        ...settings,
        themePreset: 'custom',
      });
      return;
    }

    const { newOverlay, newSubs } = applyThemeToSettings(theme, settings, effectiveSubtitles);
    onChange(newOverlay);
    if (newSubs && onAiSubtitlesChange) {
      onAiSubtitlesChange(newSubs);
    }
  };

  const handleSaveCustomTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customThemeName.trim();
    if (!trimmed) return;

    try {
      setIsSavingTheme(true);
      setThemeSaveMessage(null);

      const res = await fetch('/api/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          description: customThemeDesc.trim(),
          badge: 'Custom',
          colorPreview: {
            bg: settings.top.bgBoxEnabled ? settings.top.bgBoxColor : '#000000',
            text: settings.top.fontColor,
            border: settings.top.outlineColor || '#2196F3',
          },
          top: settings.top,
          bottom: settings.bottom,
          aiSubtitles: effectiveSubtitles,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save theme');
      }

      await fetchThemes();
      onChange({
        ...settings,
        themePreset: data.theme.id,
      });
      setThemeSaveMessage(`Theme "${trimmed}" saved to MongoDB!`);
      setShowSaveThemeModal(false);
      setCustomThemeName('');
      setCustomThemeDesc('');
      setTimeout(() => setThemeSaveMessage(null), 4000);
    } catch (err: unknown) {
      setThemeSaveMessage(err instanceof Error ? err.message : 'Error saving custom theme');
    } finally {
      setIsSavingTheme(false);
    }
  };

  const effectiveSubtitles: AISubtitleSettings = aiSubtitles || {
    enabled: false,
    subtitles: [],
    fontSize: 22,
    fontColor: '#FFFFFF',
    outlineColor: '#000000',
    outlineWidth: 2,
    marginV: 35,
  };

  const updateAiSubtitles = (partial: Partial<AISubtitleSettings>) => {
    if (onAiSubtitlesChange) {
      onAiSubtitlesChange({
        ...effectiveSubtitles,
        ...partial,
      });
    }
  };

  const handleTranscribeAudio = async () => {
    if (!uploadedVideoId && !sanitizedFilename) {
      setTranscribeError('Please upload a video in Step 1 first before transcribing.');
      return;
    }
    setIsTranscribing(true);
    setTranscribeError(null);
    setTranscribeSuccess(null);
    try {
      const res = await fetch('/api/subtitles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: uploadedVideoId,
          sanitizedFilename,
          originalFilename,
          startSec: 0,
          durationSec: 60,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate subtitles with Gemini AI.');
      }
      updateAiSubtitles({
        enabled: true,
        subtitles: data.subtitles || [],
      });
      setTranscribeSuccess(`Successfully transcribed ${data.count || 0} timestamped subtitles with Gemini AI!`);
    } catch (err: unknown) {
      setTranscribeError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsTranscribing(false);
    }
  };

  const currentSlotConfig = activeSlot === 'top' ? settings.top : settings.bottom;

  const updateSlot = (slot: 'top' | 'bottom', partial: Partial<TextSlotConfig>) => {
    onChange({
      ...settings,
      [slot]: {
        ...settings[slot],
        ...partial,
      },
    });
  };

  const insertToken = (token: string) => {
    if (activeSlot === 'subtitles') return;
    const currentText = currentSlotConfig.text || '';
    updateSlot(activeSlot, { text: `${currentText} ${token}`.trim() });
  };

  const handleApplyMultiline = () => {
    if (!pasteModalSlot) return;
    const lines = multilineInput.split(/\r?\n/).filter((l) => l.trim().length > 0);
    updateSlot(pasteModalSlot, {
      mode: 'different',
      perPartTexts: lines,
    });
    setPasteModalSlot(null);
    setMultilineInput('');
  };

  const fillAllWithCurrent = () => {
    if (activeSlot === 'subtitles') return;
    const currentText = currentSlotConfig.text || '';
    const repeated = Array(partCount).fill(currentText);
    updateSlot(activeSlot, { perPartTexts: repeated });
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-[#90CAF9]/60 shadow-sm flex flex-col gap-6">
      {/* Top Slot Tabs */}
      <div className="flex items-center justify-between pb-4 border-b border-[#90CAF9]/40">
        <div>
          <h3 className="text-base font-bold text-[#0D47A1] mb-0.5">Text Overlays & Titles</h3>
          <p className="text-xs text-slate-600">
            Add branded captions, episode badges, and subtitles with multi-language font shaping.
          </p>
        </div>

        {/* Slot Switcher */}
        <div className="flex items-center bg-[#F0F7FF] p-1 rounded-xl border border-[#90CAF9]/60 shadow-sm">
          <button
            onClick={() => setActiveSlot('top')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSlot === 'top'
                ? 'bg-[#2196F3] text-white shadow-sm'
                : 'text-slate-600 hover:text-[#0D47A1]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                settings.top.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'
              }`}
            />
            Top Text Slot
          </button>
          <button
            onClick={() => setActiveSlot('bottom')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSlot === 'bottom'
                ? 'bg-[#2196F3] text-white shadow-sm'
                : 'text-slate-600 hover:text-[#0D47A1]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                settings.bottom.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'
              }`}
            />
            Bottom Text Slot
          </button>
          <button
            onClick={() => setActiveSlot('subtitles')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSlot === 'subtitles'
                ? 'bg-[#2196F3] text-white shadow-sm'
                : 'text-slate-600 hover:text-[#0D47A1]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                effectiveSubtitles.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'
              }`}
            />
            <Sparkles className="w-3.5 h-3.5" />
            AI Subtitles (Gemini)
          </button>
        </div>
      </div>

      {/* Visual Theme Selector Ribbon */}
      <div className="bg-[#F0F7FF] p-4 rounded-xl border border-[#90CAF9]/60 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#2196F3]" />
            <h4 className="text-xs font-bold text-[#0D47A1]">Video &amp; Caption Theme Presets</h4>
            <span className="text-[10px] text-slate-500 font-medium">
              (One-click viral styling for titles, boxes &amp; subtitles)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {themeSaveMessage && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-in fade-in">
                {themeSaveMessage}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowSaveThemeModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-[#0D47A1] bg-white border border-[#90CAF9] rounded-lg hover:border-[#2196F3] hover:bg-white shadow-xs transition-all btn-pressable"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-[#2196F3]" /> Save Current as Custom Theme
            </button>
          </div>
        </div>

        {/* Theme Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {availableThemes.map((theme) => {
            const isSelected =
              settings.themePreset === theme.id ||
              (!settings.themePreset && theme.id === 'tiktok-viral');
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleSelectTheme(theme)}
                className={`p-2.5 rounded-xl border text-left transition-all btn-pressable flex flex-col justify-between gap-1.5 relative ${
                  isSelected
                    ? 'bg-white border-2 border-[#2196F3] shadow-md ring-2 ring-[#2196F3]/25'
                    : 'bg-white/80 border-[#90CAF9]/60 hover:border-[#2196F3] hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                    {theme.badge}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#2196F3]" />}
                </div>

                <div>
                  <span className="text-xs font-bold text-[#0D47A1] block truncate">
                    {theme.name}
                  </span>
                  <p className="text-[9px] text-slate-500 leading-tight line-clamp-1">
                    {theme.description}
                  </p>
                </div>

                {/* Swatch preview */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                  <div
                    className="w-3.5 h-3.5 rounded-md border text-[8px] flex items-center justify-center font-bold"
                    style={{
                      backgroundColor: theme.colorPreview?.bg || '#000',
                      color: theme.colorPreview?.text || '#FFF',
                      borderColor: theme.colorPreview?.border || '#999',
                    }}
                  >
                    Aa
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {theme.isCustom ? 'Custom' : 'Preset'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Slot Configuration */}
      {activeSlot === 'subtitles' ? (
        <div className="flex flex-col gap-5">
          {/* Enable AI Subtitles Toggle */}
          <div className="flex items-center justify-between bg-[#F0F7FF] p-4 rounded-xl border border-[#90CAF9]/60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#E3F2FD] border border-[#90CAF9] flex items-center justify-center text-[#2196F3] font-bold shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0D47A1]">Enable AI Subtitles (Gemini)</p>
                <p className="text-[11px] text-slate-600">
                  Transcribes speech-to-text with exact timestamps and burns subtitles at the bottom of each video part.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={effectiveSubtitles.enabled}
                onChange={(e) => updateAiSubtitles({ enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2196F3]" />
            </label>
          </div>

          {effectiveSubtitles.enabled && (
            <div className="flex flex-col gap-5">
              {/* Transcription Trigger Card */}
              <div className="bg-[#F0F7FF] p-4 rounded-xl border border-[#90CAF9]/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#E3F2FD] border border-[#90CAF9] flex items-center justify-center text-[#2196F3] shrink-0">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#0D47A1]">Generate Subtitles with Gemini AI</p>
                    <p className="text-[11px] text-slate-600">
                      {effectiveSubtitles.subtitles && effectiveSubtitles.subtitles.length > 0
                        ? `${effectiveSubtitles.subtitles.length} timestamped subtitle cues generated and ready.`
                        : 'Extracts audio from uploaded video and generates timestamped subtitles using Google Gemini.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleTranscribeAudio}
                    disabled={isTranscribing || (!uploadedVideoId && !sanitizedFilename)}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                      isTranscribing || (!uploadedVideoId && !sanitizedFilename)
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                        : 'bg-[#2196F3] hover:bg-[#1E88E5] text-white border border-[#2196F3] shadow-[#2196F3]/25'
                    }`}
                  >
                    {isTranscribing ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        Transcribing Audio with Gemini...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        {effectiveSubtitles.subtitles && effectiveSubtitles.subtitles.length > 0
                          ? 'Re-transcribe Audio'
                          : 'Transcribe Video Audio'}
                      </>
                    )}
                  </button>
                  {effectiveSubtitles.subtitles && effectiveSubtitles.subtitles.length > 0 && (
                    <button
                      onClick={() => updateAiSubtitles({ subtitles: [] })}
                      title="Clear subtitles"
                      className="p-2 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 transition-all shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Informational hints */}
              {!uploadedVideoId && !sanitizedFilename && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs font-medium">
                  <Info className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Please upload a video in Step 1 to transcribe audio here, or start render and worker will auto-transcribe each part one-by-one during processing.</span>
                </div>
              )}

              {transcribeError && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-xs font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{transcribeError}</span>
                </div>
              )}

              {transcribeSuccess && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{transcribeSuccess}</span>
                </div>
              )}

              {/* Subtitle Cue Inspector (if subtitles exist) */}
              {effectiveSubtitles.subtitles && effectiveSubtitles.subtitles.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0D47A1]">
                      Generated Subtitle Segments ({effectiveSubtitles.subtitles.length} total):
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Auto-sliced & synced per split part
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-[#90CAF9]/60 bg-white max-h-[200px] overflow-y-auto shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#E3F2FD] text-[#0D47A1] uppercase text-[10px] font-mono font-bold sticky top-0 border-b border-[#90CAF9]/40">
                        <tr>
                          <th className="py-2 px-3 w-16">#</th>
                          <th className="py-2 px-3 w-36">Time Window</th>
                          <th className="py-2 px-3">Subtitle Text</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#90CAF9]/30 font-mono">
                        {effectiveSubtitles.subtitles.map((cue, idx) => {
                          const startMin = Math.floor(cue.start / 60);
                          const startSec = (cue.start % 60).toFixed(1);
                          const endMin = Math.floor(cue.end / 60);
                          const endSec = (cue.end % 60).toFixed(1);
                          return (
                            <tr key={idx} className="hover:bg-[#F0F7FF]/50 transition-colors">
                              <td className="py-1.5 px-3 text-slate-400 text-[11px] font-bold">
                                {idx + 1}
                              </td>
                              <td className="py-1.5 px-3 text-[#0D47A1] font-semibold text-[11px]">
                                {`${startMin}:${startSec.padStart(4, '0')} - ${endMin}:${endSec.padStart(4, '0')}`}
                              </td>
                              <td className="py-1.5 px-3 text-slate-700 font-sans font-medium text-xs">
                                {cue.text}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Subtitle Appearance & Placement Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-[#90CAF9]/40">
                {/* Font Size */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-bold text-[#0D47A1]">Subtitle Font Size</label>
                    <span className="text-[11px] text-[#0D47A1] font-mono font-bold">{effectiveSubtitles.fontSize || 22}px</span>
                  </div>
                  <input
                    type="range"
                    min="14"
                    max="44"
                    value={effectiveSubtitles.fontSize || 22}
                    onChange={(e) => updateAiSubtitles({ fontSize: Number(e.target.value) })}
                    className="w-full accent-[#2196F3]"
                  />
                </div>

                {/* Font Color */}
                <div>
                  <label className="text-[11px] font-bold text-[#0D47A1] block mb-1">
                    Font Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={effectiveSubtitles.fontColor || '#FFFFFF'}
                      onChange={(e) => updateAiSubtitles({ fontColor: e.target.value })}
                      className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={effectiveSubtitles.fontColor || '#FFFFFF'}
                      onChange={(e) => updateAiSubtitles({ fontColor: e.target.value })}
                      className="w-24 bg-white border border-[#90CAF9] rounded-lg px-2.5 py-1 text-xs text-[#0D47A1] font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Outline Width & Color */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-bold text-[#0D47A1]">Outline Width</label>
                    <span className="text-[11px] text-[#0D47A1] font-mono font-bold">{effectiveSubtitles.outlineWidth || 2}px</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="6"
                      value={effectiveSubtitles.outlineWidth || 2}
                      onChange={(e) => updateAiSubtitles({ outlineWidth: Number(e.target.value) })}
                      className="w-full accent-[#2196F3]"
                    />
                    <input
                      type="color"
                      value={effectiveSubtitles.outlineColor || '#000000'}
                      onChange={(e) => updateAiSubtitles({ outlineColor: e.target.value })}
                      className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                    />
                  </div>
                </div>

                {/* Bottom Margin (MarginV) */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-bold text-[#0D47A1]">Bottom Margin</label>
                    <span className="text-[11px] text-[#0D47A1] font-mono font-bold">{effectiveSubtitles.marginV || 35}px</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="120"
                    value={effectiveSubtitles.marginV || 35}
                    onChange={(e) => updateAiSubtitles({ marginV: Number(e.target.value) })}
                    className="w-full accent-[#2196F3]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Enable Slot Toggle */}
          <div className="flex items-center justify-between bg-[#F0F7FF] p-4 rounded-xl border border-[#90CAF9]/60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#E3F2FD] border border-[#90CAF9] flex items-center justify-center text-[#2196F3] font-bold shadow-sm">
                <Type className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0D47A1] capitalize">Enable {activeSlot} Text Slot</p>
                <p className="text-[11px] text-slate-600">
                  Renders safe text overlay on top of the reframed video
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={currentSlotConfig.enabled}
                onChange={(e) => updateSlot(activeSlot, { enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2196F3]" />
            </label>
          </div>

        {currentSlotConfig.enabled && (
          <div className="flex flex-col gap-5">
            {/* Mode Switcher: Same vs Different Per Part */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#0D47A1]">Text Content Mode:</span>
                <div className="inline-flex bg-[#F0F7FF] p-1 rounded-lg border border-[#90CAF9]/60 text-xs">
                  <button
                    onClick={() => updateSlot(activeSlot, { mode: 'same' })}
                    className={`px-3 py-1 rounded-md font-semibold transition-all ${
                      currentSlotConfig.mode === 'same'
                        ? 'bg-[#2196F3] text-white shadow-sm'
                        : 'text-slate-600 hover:text-[#0D47A1]'
                    }`}
                  >
                    Same Text for All Parts
                  </button>
                  <button
                    onClick={() => updateSlot(activeSlot, { mode: 'different' })}
                    className={`px-3 py-1 rounded-md font-semibold transition-all ${
                      currentSlotConfig.mode === 'different'
                        ? 'bg-[#2196F3] text-white shadow-sm'
                        : 'text-slate-600 hover:text-[#0D47A1]'
                    }`}
                  >
                    Different Text Per Part ({partCount} Rows)
                  </button>
                </div>
              </div>

              {currentSlotConfig.mode === 'different' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPasteModalSlot(activeSlot)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white hover:bg-[#E3F2FD] text-[#0D47A1] border border-[#90CAF9] text-xs font-semibold transition-all shadow-sm"
                  >
                    <ClipboardPaste className="w-3 h-3 text-[#2196F3]" />
                    Paste Multi-Line
                  </button>
                  <button
                    onClick={fillAllWithCurrent}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white hover:bg-[#E3F2FD] text-slate-700 border border-[#90CAF9] text-xs font-semibold transition-all shadow-sm"
                  >
                    <Copy className="w-3 h-3 text-[#2196F3]" />
                    Fill All With Same
                  </button>
                </div>
              )}
            </div>

            {/* Token Insertion Helper Buttons */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[11px] text-slate-500 font-semibold">Quick Tokens:</span>
              {[
                { token: '{part}', label: '+ Part #' },
                { token: '{total}', label: '+ Total Parts' },
                { token: '{title}', label: '+ Video Title' },
              ].map(({ token, label }) => (
                <button
                  key={token}
                  onClick={() => insertToken(token)}
                  className="px-2.5 py-1 rounded-md bg-[#E3F2FD] hover:bg-[#90CAF9]/40 text-[#0D47A1] border border-[#90CAF9] text-[11px] font-mono font-bold transition-all"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Same Mode: Single Input */}
            {currentSlotConfig.mode === 'same' && (
              <div className="bg-[#F0F7FF] p-3.5 rounded-xl border border-[#90CAF9]/60">
                <label className="text-[11px] text-slate-600 font-medium block mb-1">
                  Text template (Example: &quot;Part &#123;part&#125;/&#123;total&#125; - &#123;title&#125;&quot;)
                </label>
                <input
                  type="text"
                  value={currentSlotConfig.text}
                  onChange={(e) => updateSlot(activeSlot, { text: e.target.value })}
                  placeholder="Enter text with optional {part}/{total}/{title} tokens..."
                  className="w-full bg-white border border-[#90CAF9] rounded-lg px-3.5 py-2 text-xs text-[#0D47A1] font-semibold placeholder-slate-400 focus:outline-none focus:border-[#2196F3] focus:ring-2 focus:ring-[#2196F3]/20"
                />
              </div>
            )}

            {/* Different Mode: Per-Part Table */}
            {currentSlotConfig.mode === 'different' && (
              <div className="overflow-hidden rounded-xl border border-[#90CAF9]/60 bg-white max-h-[220px] overflow-y-auto shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#E3F2FD] text-[#0D47A1] uppercase text-[10px] font-mono font-bold sticky top-0 border-b border-[#90CAF9]/40">
                    <tr>
                      <th className="py-2 px-3 w-20">Part</th>
                      <th className="py-2 px-3">Custom Text</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#90CAF9]/30 font-mono">
                    {Array.from({ length: Math.max(1, partCount) }).map((_, idx) => {
                      const partIdx = idx + 1;
                      const val = currentSlotConfig.perPartTexts[idx] ?? '';
                      return (
                        <tr key={partIdx}>
                          <td className="py-2 px-3 font-bold text-[#0D47A1]">
                            Part {String(partIdx).padStart(2, '0')}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={val}
                              placeholder={`Text for part ${partIdx}...`}
                              onChange={(e) => {
                                const newArr = [...currentSlotConfig.perPartTexts];
                                newArr[idx] = e.target.value;
                                updateSlot(activeSlot, { perPartTexts: newArr });
                              }}
                              className="w-full bg-white border border-[#90CAF9] rounded px-2.5 py-1 text-xs text-[#0D47A1] font-semibold focus:outline-none focus:border-[#2196F3]"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Typography & Styling Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2 border-t border-[#90CAF9]/40">
              {/* Font Family */}
              <div>
                <label className="text-[11px] font-bold text-[#0D47A1] block mb-1">
                  Font Family
                </label>
                <CustomSelect
                  value={currentSlotConfig.fontFamily}
                  onChange={(val) => updateSlot(activeSlot, { fontFamily: val })}
                  size="sm"
                  options={SUPPORTED_FONTS.map((font) => ({
                    value: font.id,
                    label: font.name,
                  }))}
                />
              </div>

              {/* Font Size */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-[#0D47A1]">Font Size</label>
                  <span className="text-[11px] text-[#0D47A1] font-mono font-bold">{currentSlotConfig.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="90"
                  value={currentSlotConfig.fontSize}
                  onChange={(e) => updateSlot(activeSlot, { fontSize: Number(e.target.value) })}
                  className="w-full accent-[#2196F3]"
                />
              </div>

              {/* Font Color */}
              <div>
                <label className="text-[11px] font-bold text-[#0D47A1] block mb-1">
                  Font Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentSlotConfig.fontColor}
                    onChange={(e) => updateSlot(activeSlot, { fontColor: e.target.value })}
                    className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={currentSlotConfig.fontColor}
                    onChange={(e) => updateSlot(activeSlot, { fontColor: e.target.value })}
                    className="w-24 bg-white border border-[#90CAF9] rounded-lg px-2.5 py-1 text-xs text-[#0D47A1] font-mono font-bold"
                  />
                </div>
              </div>

              {/* Outline Width & Color */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-[#0D47A1]">Outline Width</label>
                  <span className="text-[11px] text-[#0D47A1] font-mono font-bold">{currentSlotConfig.outlineWidth}px</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={currentSlotConfig.outlineWidth}
                    onChange={(e) => updateSlot(activeSlot, { outlineWidth: Number(e.target.value) })}
                    className="w-full accent-[#2196F3]"
                  />
                  <input
                    type="color"
                    value={currentSlotConfig.outlineColor}
                    onChange={(e) => updateSlot(activeSlot, { outlineColor: e.target.value })}
                    className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                  />
                </div>
              </div>

              {/* Background Box */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-[#0D47A1]">Background Box</label>
                  <input
                    type="checkbox"
                    checked={currentSlotConfig.bgBoxEnabled}
                    onChange={(e) => updateSlot(activeSlot, { bgBoxEnabled: e.target.checked })}
                    className="accent-[#2196F3]"
                  />
                </div>
                {currentSlotConfig.bgBoxEnabled ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={currentSlotConfig.bgBoxOpacity}
                      onChange={(e) => updateSlot(activeSlot, { bgBoxOpacity: Number(e.target.value) })}
                      className="w-full accent-[#2196F3]"
                    />
                    <input
                      type="color"
                      value={currentSlotConfig.bgBoxColor}
                      onChange={(e) => updateSlot(activeSlot, { bgBoxColor: e.target.value })}
                      className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                    />
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">Disabled</p>
                )}
              </div>

              {/* Alignment */}
              <div>
                <label className="text-[11px] font-bold text-[#0D47A1] block mb-1">
                  Text Alignment
                </label>
                <div className="flex items-center bg-[#F0F7FF] p-1 rounded-lg border border-[#90CAF9]/60">
                  {(['left', 'center', 'right'] as const).map((align) => (
                    <button
                      key={align}
                      onClick={() => updateSlot(activeSlot, { alignment: align })}
                      className={`flex-1 py-1 rounded text-xs flex justify-center items-center capitalize transition-all ${
                        currentSlotConfig.alignment === align
                          ? 'bg-[#2196F3] text-white shadow-sm'
                          : 'text-slate-600 hover:text-[#0D47A1]'
                      }`}
                    >
                      {align === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
                      {align === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
                      {align === 'right' && <AlignRight className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Display Timing Controls */}
            <div className="pt-3 border-t border-[#90CAF9]/40 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-[#2196F3] shrink-0" />
                <div>
                  <p className="text-xs font-bold text-[#0D47A1]">Display Timing</p>
                  <p className="text-[11px] text-slate-600 font-medium">
                    Show for the full part duration or fade after N seconds
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-medium">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                  <input
                    type="radio"
                    name={`timing_${activeSlot}`}
                    checked={currentSlotConfig.durationMode === 'full'}
                    onChange={() => updateSlot(activeSlot, { durationMode: 'full' })}
                    className="accent-[#2196F3]"
                  />
                  Entire Part
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                  <input
                    type="radio"
                    name={`timing_${activeSlot}`}
                    checked={currentSlotConfig.durationMode === 'firstN'}
                    onChange={() => updateSlot(activeSlot, { durationMode: 'firstN' })}
                    className="accent-[#2196F3]"
                  />
                  First
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={currentSlotConfig.durationSeconds}
                    onChange={(e) => updateSlot(activeSlot, { durationSeconds: Number(e.target.value) })}
                    className="w-12 bg-white border border-[#90CAF9] rounded px-1.5 py-0.5 text-center text-[#0D47A1] font-mono font-bold"
                  />
                  seconds
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Multi-Line Paste Modal */}
      {pasteModalSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full flex flex-col gap-4 border border-[#90CAF9] shadow-2xl">
            <h4 className="text-sm font-bold text-[#0D47A1] flex items-center gap-2">
              <ClipboardPaste className="w-4 h-4 text-[#2196F3]" />
              Paste Multiple Lines ({pasteModalSlot.toUpperCase()} TEXT)
            </h4>
            <p className="text-xs text-slate-600 font-medium">
              Paste lines from a script or spreadsheet. Line 1 will assign to Part 1, Line 2 to Part 2, etc.
            </p>
            <textarea
              rows={6}
              value={multilineInput}
              onChange={(e) => setMultilineInput(e.target.value)}
              placeholder="Part 1 headline...&#10;Part 2 headline...&#10;Part 3 headline..."
              className="w-full bg-white border border-[#90CAF9] rounded-xl p-3 text-xs text-[#0D47A1] placeholder-slate-400 focus:outline-none focus:border-[#2196F3] font-mono font-semibold"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setPasteModalSlot(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-[#0D47A1]"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyMultiline}
                className="px-4 py-2 rounded-xl bg-[#2196F3] hover:bg-[#1E88E5] text-white text-xs font-bold shadow-md shadow-[#2196F3]/25"
              >
                Apply to Parts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Custom Theme Modal */}
      {showSaveThemeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-[#90CAF9] shadow-2xl w-full max-w-md p-6 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-[#0D47A1]">
                <BookmarkPlus className="w-5 h-5 text-[#2196F3]" />
                <h3 className="text-sm font-bold">Save Current Style as Custom Theme</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveThemeModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomTheme} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0D47A1] mb-1">
                  Theme Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={customThemeName}
                  onChange={(e) => setCustomThemeName(e.target.value)}
                  placeholder="e.g. Neon Horizon, Bold Crime Docu, Clean Reel"
                  required
                  autoFocus
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-[#90CAF9] rounded-xl focus:outline-none focus:border-[#2196F3] focus:ring-2 focus:ring-[#2196F3]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0D47A1] mb-1">
                  Theme Description / Tags
                </label>
                <input
                  type="text"
                  value={customThemeDesc}
                  onChange={(e) => setCustomThemeDesc(e.target.value)}
                  placeholder="e.g. Yellow headers with solid black box and 24pt subtitles"
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-[#90CAF9] rounded-xl focus:outline-none focus:border-[#2196F3] focus:ring-2 focus:ring-[#2196F3]/20"
                />
              </div>

              <div className="p-3 bg-[#F0F7FF] rounded-xl border border-[#90CAF9]/60 text-[11px] text-slate-600 space-y-1">
                <span className="font-bold text-[#0D47A1] block">Included In This Theme:</span>
                <div>• Top font: {settings.top.fontFamily} ({settings.top.fontSize}px, {settings.top.fontColor})</div>
                <div>• Bottom font: {settings.bottom.fontFamily} ({settings.bottom.fontSize}px, {settings.bottom.fontColor})</div>
                <div>• Background Boxing: {settings.top.bgBoxEnabled ? `Enabled (${Math.round(settings.top.bgBoxOpacity * 100)}%)` : 'Off'}</div>
                <div>• Subtitles Style: {effectiveSubtitles.fontSize}px, {effectiveSubtitles.fontColor}</div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSaveThemeModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTheme}
                  className="px-4 py-2 bg-[#2196F3] hover:bg-[#1E88E5] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#2196F3]/30 transition-all disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isSavingTheme ? 'Saving to Database...' : 'Save Theme'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
