'use client';

import React, { useState, useEffect } from 'react';
import { Film, Activity, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { AspectRatioPreset, ReframeMode, TextOverlaySettings } from '@/shared/schemas';
import { VideoProbeData } from '@/shared/types';
import { evaluateTextTokens } from '@/lib/renderer/textProcessor';

interface PreviewCanvasProps {
  sourceFilename?: string;
  aspectRatio: AspectRatioPreset;
  reframeMode: ReframeMode;
  backgroundColor?: string;
  focalPoint?: 'left' | 'center' | 'right' | 'auto_face';
  probe?: VideoProbeData;
  textOverlay?: TextOverlaySettings;
  showSafeZone?: boolean;
  onToggleSafeZone?: () => void;
  previewPartIndex?: number;
  totalParts?: number;
}

export function PreviewCanvas({
  sourceFilename,
  aspectRatio,
  reframeMode,
  backgroundColor = '#000000',
  focalPoint = 'center',
  probe,
  textOverlay,
  showSafeZone = true,
  onToggleSafeZone,
  previewPartIndex = 1,
  totalParts = 5,
}: PreviewCanvasProps) {
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [isLoadingFrame, setIsLoadingFrame] = useState(false);

  const aspectClass =
    aspectRatio === '9:16'
      ? 'aspect-[9/16]'
      : aspectRatio === '1:1'
      ? 'aspect-square'
      : aspectRatio === '4:5'
      ? 'aspect-[4/5]'
      : 'aspect-video';

  // Evaluate Top & Bottom text for preview display
  const tokenContext = {
    partIndex: previewPartIndex,
    totalParts: Math.max(1, totalParts),
    originalFilename: sourceFilename || 'My_Video.mp4',
  };

  const topTextString = textOverlay?.top?.enabled
    ? evaluateTextTokens(
        textOverlay.top.mode === 'different'
          ? textOverlay.top.perPartTexts[previewPartIndex - 1] || textOverlay.top.text || ''
          : textOverlay.top.text || '',
        tokenContext
      )
    : '';

  const bottomTextString = textOverlay?.bottom?.enabled
    ? evaluateTextTokens(
        textOverlay.bottom.mode === 'different'
          ? textOverlay.bottom.perPartTexts[previewPartIndex - 1] || textOverlay.bottom.text || ''
          : textOverlay.bottom.text || '',
        tokenContext
      )
    : '';

  useEffect(() => {
    if (!sourceFilename) {
      setFrameUrl(null);
      return;
    }

    let isMounted = true;
    const fetchFrame = async () => {
      try {
        setIsLoadingFrame(true);
        const res = await fetch('/api/preview/frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceFilename,
            aspectRatio,
            reframeMode,
            backgroundColor,
            focalPoint,
            timestamp: 1.0,
          }),
        });

        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          if (isMounted) setFrameUrl(url);
        }
      } catch {
        // Fallback to client simulator
      } finally {
        if (isMounted) setIsLoadingFrame(false);
      }
    };

    const timer = setTimeout(fetchFrame, 350);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [sourceFilename, aspectRatio, reframeMode, backgroundColor, focalPoint]);

  return (
    <div className="bg-white rounded-2xl p-5 border border-[#90CAF9]/60 shadow-sm flex flex-col gap-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#0D47A1] flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[#2196F3]" />
          Live Frame Canvas
        </h4>
        <div className="flex items-center gap-2">
          {onToggleSafeZone && (
            <button
              onClick={onToggleSafeZone}
              title="Toggle Social UI Safe Zone Guide"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                showSafeZone
                  ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-sm'
                  : 'bg-[#E3F2FD] text-[#0D47A1] border-[#90CAF9] hover:bg-[#90CAF9]/30'
              }`}
            >
              {showSafeZone ? <Eye className="w-3 h-3 text-rose-600" /> : <EyeOff className="w-3 h-3" />}
              Safe Zone
            </button>
          )}
          <span className="text-[10px] font-mono font-bold text-[#0D47A1] bg-[#E3F2FD] px-2.5 py-1 rounded-lg border border-[#90CAF9]">
            {aspectRatio}
          </span>
        </div>
      </div>

      {/* Canvas Viewport Styled Like a Sleek Mobile Screen */}
      <div
        className={`relative ${aspectClass} max-h-[380px] w-full mx-auto rounded-2xl bg-slate-950 border-4 border-slate-800/90 flex items-center justify-center overflow-hidden shadow-lg group`}
      >
        {frameUrl ? (
          <img
            src={frameUrl}
            alt="Server-rendered preview"
            className="w-full h-full object-contain"
          />
        ) : (
          <>
            {reframeMode === 'blur' && (
              <div className="absolute inset-0 bg-gradient-to-b from-[#2196F3]/30 via-sky-900/40 to-slate-950/90 blur-xl scale-125 opacity-70" />
            )}

            {reframeMode === 'solid' && (
              <div
                className="absolute inset-0 transition-colors"
                style={{ backgroundColor: backgroundColor || '#000000' }}
              />
            )}

            <div
              className={`relative z-10 w-full ${
                reframeMode === 'crop' ? 'h-full object-cover' : 'aspect-video'
              } bg-blue-900/30 border border-blue-400/20 rounded-lg flex flex-col items-center justify-center p-3 text-center`}
            >
              <Film className="w-6 h-6 text-[#90CAF9] mb-1 opacity-90" />
              <p className="text-[10px] text-white font-bold truncate max-w-[200px]">
                {sourceFilename || 'Source Video'}
              </p>
              <p className="text-[9px] text-[#90CAF9] font-mono font-semibold">
                {probe
                  ? `${probe.displayWidth}x${probe.displayHeight} • ${reframeMode}`
                  : `16:9 Fit (${reframeMode})`}
              </p>
            </div>
          </>
        )}

        {/* Live Top Text Overlay Layer */}
        {textOverlay?.top?.enabled && topTextString && (
          <div
            className="absolute z-30 pointer-events-none px-4 text-center w-full"
            style={{
              top: `${Math.min(18, (textOverlay.top.margin || 40) / 10)}%`,
              textAlign: textOverlay.top.alignment || 'center',
            }}
          >
            <span
              className="inline-block rounded px-2 py-0.5 font-bold transition-all shadow-md"
              style={{
                fontFamily: textOverlay.top.fontFamily || 'sans-serif',
                fontSize: `${Math.max(10, Math.min(22, (textOverlay.top.fontSize || 36) * 0.4))}px`,
                color: textOverlay.top.fontColor || '#FFFFFF',
                textShadow:
                  textOverlay.top.outlineWidth && textOverlay.top.outlineWidth > 0
                    ? `0 0 ${textOverlay.top.outlineWidth * 2}px ${textOverlay.top.outlineColor || '#000000'}`
                    : 'none',
                backgroundColor: textOverlay.top.bgBoxEnabled
                  ? `${textOverlay.top.bgBoxColor || '#000000'}${Math.round((textOverlay.top.bgBoxOpacity ?? 0.6) * 255)
                      .toString(16)
                      .padStart(2, '0')}`
                  : 'transparent',
              }}
            >
              {topTextString}
            </span>
          </div>
        )}

        {/* Live Bottom Text Overlay Layer */}
        {textOverlay?.bottom?.enabled && bottomTextString && (
          <div
            className="absolute z-30 pointer-events-none px-4 text-center w-full"
            style={{
              bottom: `${Math.min(18, (textOverlay.bottom.margin || 40) / 10)}%`,
              textAlign: textOverlay.bottom.alignment || 'center',
            }}
          >
            <span
              className="inline-block rounded px-2 py-0.5 font-bold transition-all shadow-md"
              style={{
                fontFamily: textOverlay.bottom.fontFamily || 'sans-serif',
                fontSize: `${Math.max(10, Math.min(22, (textOverlay.bottom.fontSize || 36) * 0.4))}px`,
                color: textOverlay.bottom.fontColor || '#FFFFFF',
                textShadow:
                  textOverlay.bottom.outlineWidth && textOverlay.bottom.outlineWidth > 0
                    ? `0 0 ${textOverlay.bottom.outlineWidth * 2}px ${textOverlay.bottom.outlineColor || '#000000'}`
                    : 'none',
                backgroundColor: textOverlay.bottom.bgBoxEnabled
                  ? `${textOverlay.bottom.bgBoxColor || '#000000'}${Math.round((textOverlay.bottom.bgBoxOpacity ?? 0.6) * 255)
                      .toString(16)
                      .padStart(2, '0')}`
                  : 'transparent',
              }}
            >
              {bottomTextString}
            </span>
          </div>
        )}

        {/* Safe-Zone Guide Overlay */}
        {showSafeZone && aspectRatio === '9:16' && (
          <div className="absolute inset-x-3 top-4 bottom-14 border border-dashed border-rose-400 rounded-lg pointer-events-none flex flex-col justify-between p-1.5 z-20">
            <span className="text-[8px] text-white font-mono bg-rose-600/90 px-1.5 py-0.5 rounded shadow self-center font-bold">
              Safe Zone (Reels / TikTok / Shorts)
            </span>
            <div className="flex justify-between items-end text-[7px] text-rose-300 font-mono font-bold bg-black/50 px-1 py-0.5 rounded">
              <span>Title Margin</span>
              <span>Bottom Action Bar UI</span>
            </div>
          </div>
        )}

        {isLoadingFrame && (
          <div className="absolute top-2 right-2 bg-white/90 border border-[#90CAF9] px-2 py-0.5 rounded-full text-[9px] text-[#0D47A1] font-bold flex items-center gap-1 z-30 shadow">
            <RefreshCw className="w-2.5 h-2.5 animate-spin text-[#2196F3]" />
            Updating Frame...
          </div>
        )}
      </div>

      {/* Metadata Facts Strip */}
      <div className="text-[11px] text-slate-600 space-y-1.5 pt-2 border-t border-[#90CAF9]/40 font-medium">
        <div className="flex justify-between">
          <span className="text-slate-500">Reframe mode:</span>
          <span className="text-[#0D47A1] font-bold capitalize">{reframeMode}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Output Aspect:</span>
          <span className="text-[#0D47A1] font-bold">{aspectRatio}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Text Overlays:</span>
          <span className="text-[#0D47A1] font-bold">
            {textOverlay?.top?.enabled || textOverlay?.bottom?.enabled
              ? `${textOverlay?.top?.enabled ? 'Top' : ''} ${textOverlay?.top?.enabled && textOverlay?.bottom?.enabled ? '& ' : ''}${textOverlay?.bottom?.enabled ? 'Bottom' : ''}`
              : 'None'}
          </span>
        </div>
      </div>
    </div>
  );
}
