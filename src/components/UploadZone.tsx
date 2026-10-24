'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  X,
  Play,
  RotateCw,
  Clock,
  Maximize,
  Volume2,
  VolumeX,
  Gauge,
  Film,
  FileVideo,
  Zap,
  HardDrive,
  FolderOpen,
  Search,
  Check,
  RefreshCw,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Sliders,
} from 'lucide-react';
import { VideoProbeData } from '@/shared/types';

interface UploadZoneProps {
  onUploadComplete: (fileData: {
    uploadId: string;
    originalFilename: string;
    sanitizedFilename: string;
    sizeBytes: number;
    probe?: VideoProbeData;
    isDirectLocal?: boolean;
  }) => void;
  onReset?: () => void;
  onProceed?: () => void;
}

interface LocalVideoItem {
  name: string;
  fullPath: string;
  sizeBytes: number;
  sizeFormatted: string;
  modifiedAt: string;
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk

export function UploadZone({ onUploadComplete, onReset, onProceed }: UploadZoneProps) {
  // Mode: 'local' (0-wait, 0-storage direct path) or 'chunked' (traditional upload)
  const [uploadMode, setUploadMode] = useState<'local' | 'chunked'>('local');
  const [showTechDetails, setShowTechDetails] = useState<boolean>(false);

  // Local File selection state
  const [localPathInput, setLocalPathInput] = useState<string>('');
  const [isProbingLocal, setIsProbingLocal] = useState<boolean>(false);
  const [activeFolderPreset, setActiveFolderPreset] = useState<'downloads' | 'movies' | 'desktop' | 'workspace'>('workspace');
  const [folderVideos, setFolderVideos] = useState<LocalVideoItem[]>([]);
  const [isLoadingFolder, setIsLoadingFolder] = useState<boolean>(false);

  // Chunked upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speedMb, setSpeedMb] = useState(0);
  const [etaSec, setEtaSec] = useState(0);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  // Completed upload state
  const [uploadedData, setUploadedData] = useState<{
    uploadId: string;
    originalFilename: string;
    sanitizedFilename: string;
    sizeBytes: number;
    probe?: VideoProbeData;
    isDirectLocal?: boolean;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeUploadIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load videos for active folder preset
  const loadFolderVideos = useCallback(async (preset: string) => {
    try {
      setIsLoadingFolder(true);
      const res = await fetch(`/api/fs/quick-browse?folder=${preset}`);
      const data = await res.json();
      if (data.success) {
        setFolderVideos(data.videos || []);
      } else {
        setFolderVideos([]);
      }
    } catch {
      setFolderVideos([]);
    } finally {
      setIsLoadingFolder(false);
    }
  }, []);

  useEffect(() => {
    if (uploadMode === 'local') {
      loadFolderVideos(activeFolderPreset);
    }
  }, [uploadMode, activeFolderPreset, loadFolderVideos]);

  // Handle probing a direct local path (0s upload wait time, 0 storage duplicate)
  const handleProbeLocalPath = async (targetPath?: string) => {
    const pathToProbe = (targetPath || localPathInput).trim();
    if (!pathToProbe) {
      setErrorMessage('Please enter or select a video file path on your Mac.');
      return;
    }

    try {
      setErrorMessage(null);
      setIsProbingLocal(true);

      const res = await fetch('/api/upload/local-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: pathToProbe }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to inspect local video file.');
      }

      setUploadedData(data);
      onUploadComplete(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsProbingLocal(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const startChunkedUpload = async (file: File) => {
    setErrorMessage(null);
    setCurrentFile(file);
    setUploading(true);
    setProgress(0);
    setSpeedMb(0);
    setEtaSec(0);

    const totalSize = file.size;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // 1. Initiate upload session
      const initRes = await fetch('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          fileSize: totalSize,
          chunkSize: CHUNK_SIZE,
          totalChunks,
        }),
        signal: abortController.signal,
      });

      if (!initRes.ok) {
        const errorData = await initRes.json();
        throw new Error(errorData.error || 'Failed to initiate upload.');
      }

      const { uploadId } = await initRes.json();
      activeUploadIdRef.current = uploadId;

      // 2. Upload chunks with speed & ETA tracking
      const startTime = Date.now();
      let uploadedBytes = 0;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (abortController.signal.aborted) {
          throw new Error('Upload aborted by user.');
        }

        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalSize);
        const chunkBlob = file.slice(start, end);

        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', String(chunkIndex));
        formData.append('chunk', chunkBlob);

        const chunkRes = await fetch('/api/upload/chunk', {
          method: 'POST',
          body: formData,
          signal: abortController.signal,
        });

        if (!chunkRes.ok) {
          const chunkError = await chunkRes.json();
          throw new Error(chunkError.error || `Chunk ${chunkIndex} upload failed.`);
        }

        uploadedBytes += end - start;
        const currentProgress = Math.round((uploadedBytes / totalSize) * 100);
        setProgress(currentProgress);

        const elapsedSec = (Date.now() - startTime) / 1000;
        if (elapsedSec > 0.5) {
          const currentSpeedMb = uploadedBytes / (1024 * 1024) / elapsedSec;
          setSpeedMb(parseFloat(currentSpeedMb.toFixed(1)));
          const remainingBytes = totalSize - uploadedBytes;
          const remainingSec = Math.round(remainingBytes / (uploadedBytes / elapsedSec));
          setEtaSec(remainingSec);
        }
      }

      // 3. Complete and assemble upload
      const completeRes = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId }),
        signal: abortController.signal,
      });

      if (!completeRes.ok) {
        const completeError = await completeRes.json();
        throw new Error(completeError.error || 'Failed to finalize uploaded file.');
      }

      const completeData = await completeRes.json();
      setUploadedData(completeData);
      setUploading(false);
      onUploadComplete(completeData);
    } catch (err: unknown) {
      if (abortController.signal.aborted) {
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setUploading(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        // If file has a local path (Electron or local Chrome drag), probe it directly
        const maybePath = (file as any).path;
        if (maybePath) {
          setLocalPathInput(maybePath);
          handleProbeLocalPath(maybePath);
        } else {
          startChunkedUpload(file);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const maybePath = (file as any).path;
      if (maybePath) {
        setLocalPathInput(maybePath);
        handleProbeLocalPath(maybePath);
      } else {
        startChunkedUpload(file);
      }
    }
  };

  const cancelUpload = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (activeUploadIdRef.current) {
      try {
        await fetch('/api/upload/abort', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId: activeUploadIdRef.current }),
        });
      } catch {
        // Ignore abort network error
      }
    }
    setUploading(false);
    setProgress(0);
    setErrorMessage('Upload cancelled.');
  };

  const resetUpload = () => {
    setUploadedData(null);
    setCurrentFile(null);
    setProgress(0);
    setErrorMessage(null);
    setLocalPathInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onReset?.();
  };

  // If already loaded and probed, render the metadata & playable preview inspector
  if (uploadedData) {
    const probe = uploadedData.probe;
    const isDirect = !!uploadedData.isDirectLocal;
    const streamUrl = isDirect
      ? `/api/video/stream?filePath=${encodeURIComponent(uploadedData.sanitizedFilename)}`
      : `/api/video/${uploadedData.sanitizedFilename}`;

    return (
      <div className="bg-white rounded-2xl p-6 border border-[#90CAF9]/60 shadow-sm flex flex-col gap-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#90CAF9]/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-center text-emerald-600 shadow-sm">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#0D47A1] truncate max-w-md">
                  {uploadedData.originalFilename}
                </h3>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                  Ready
                </span>
                {isDirect && (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-600" /> Direct Local (0s Wait &bull; 0 Storage)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5 truncate max-w-xl">
                {(uploadedData.sizeBytes / (1024 * 1024)).toFixed(1)} MB &bull; {uploadedData.sanitizedFilename}
              </p>
            </div>
          </div>
          <button
            onClick={resetUpload}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0D47A1] bg-[#E3F2FD] hover:bg-[#90CAF9]/40 border border-[#90CAF9] transition-all flex items-center gap-1.5 shrink-0"
          >
            <RotateCw className="w-3.5 h-3.5 text-[#2196F3]" />
            Change Video
          </button>
        </div>

        {/* Video Player & Probed Facts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* HTML5 Playable Video Preview */}
          <div className="md:col-span-5 flex flex-col gap-2">
            <div className="rounded-xl overflow-hidden bg-slate-900 border border-[#90CAF9]/60 aspect-video flex items-center justify-center shadow-md">
              <video
                src={streamUrl}
                controls
                preload="metadata"
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-[10px] text-slate-500 font-medium text-center">
              Direct source preview &bull; Zero storage overhead
            </p>
          </div>

          {/* Creator-Friendly Facts & Video Stats */}
          <div className="md:col-span-7 flex flex-col justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#F0F7FF] p-3.5 rounded-xl border border-[#90CAF9]/60">
                <p className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#0288D1]" />
                  Duration
                </p>
                <p className="text-base font-extrabold text-[#0D47A1] mt-1">
                  {probe ? `${Math.floor(probe.duration / 60)}m ${Math.round(probe.duration % 60)}s` : 'N/A'}
                </p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {probe ? `${probe.duration.toFixed(1)}s total` : ''}
                </p>
              </div>

              <div className="bg-[#F0F7FF] p-3.5 rounded-xl border border-[#90CAF9]/60">
                <p className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                  <Maximize className="w-3.5 h-3.5 text-[#2196F3]" />
                  Resolution
                </p>
                <p className="text-base font-extrabold text-[#0D47A1] mt-1">
                  {probe ? `${probe.displayWidth}x${probe.displayHeight}` : 'Probing...'}
                </p>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                  {probe
                    ? probe.displayWidth > probe.displayHeight
                      ? '16:9 Landscape'
                      : probe.displayWidth < probe.displayHeight
                      ? '9:16 Vertical'
                      : '1:1 Square'
                    : ''}
                </p>
              </div>

              <div className="bg-[#F0F7FF] p-3.5 rounded-xl border border-[#90CAF9]/60">
                <p className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
                  File Size
                </p>
                <p className="text-base font-extrabold text-[#0D47A1] mt-1">
                  {(uploadedData.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                </p>
                <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                  Ready to slice
                </p>
              </div>
            </div>

            {/* Collapsible Technical Video Specs */}
            <div className="rounded-xl border border-[#90CAF9]/60 bg-[#F8FAFC] overflow-hidden">
              <button
                type="button"
                onClick={() => setShowTechDetails(!showTechDetails)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs font-bold text-[#0D47A1] hover:bg-[#F0F7FF] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-[#2196F3]" />
                  <span>Technical Stream Specs</span>
                  <span className="text-[10px] font-normal text-slate-500">
                    (Codec, Framerate, Audio Channels)
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                    showTechDetails ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showTechDetails && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 pt-1 border-t border-[#90CAF9]/40 bg-white text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Codec</span>
                    <span className="font-mono font-bold text-[#0D47A1] uppercase">{probe?.videoCodec || 'H.264'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Framerate</span>
                    <span className="font-mono font-bold text-[#0D47A1]">{probe ? `${probe.fps} fps` : 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Audio</span>
                    <span className="font-mono font-bold text-[#0D47A1]">
                      {probe?.hasAudio ? `${probe.audioCodec?.toUpperCase()} (${probe.audioChannels}ch)` : 'Silent'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Color</span>
                    <span className="font-mono font-bold text-[#0D47A1]">
                      {probe?.isHDR ? 'HDR / BT.2020' : 'SDR / Rec.709'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Direct Proceed to Framing CTA */}
            {onProceed && (
              <button
                onClick={onProceed}
                className="btn-pressable flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#2196F3] hover:bg-[#1E88E5] text-white font-bold text-xs shadow-md shadow-[#2196F3]/25 transition-all"
              >
                <span>Continue to Framing</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Mode Switcher */}
      <div className="bg-white rounded-2xl p-1.5 border border-[#90CAF9]/60 shadow-sm flex items-center gap-1.5 self-start">
        <button
          onClick={() => setUploadMode('local')}
          className={`btn-pressable flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            uploadMode === 'local'
              ? 'bg-[#2196F3] text-white shadow-md shadow-[#2196F3]/25'
              : 'text-slate-600 hover:text-slate-900 hover:bg-[#F0F7FF]'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-300" />
          <span>Direct Local File</span>
          <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-100 border border-amber-300/30">
            0s Wait &bull; 0 Storage
          </span>
        </button>

        <button
          onClick={() => setUploadMode('chunked')}
          className={`btn-pressable flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            uploadMode === 'chunked'
              ? 'bg-[#2196F3] text-white shadow-md shadow-[#2196F3]/25'
              : 'text-slate-600 hover:text-slate-900 hover:bg-[#F0F7FF]'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Traditional Upload</span>
        </button>
      </div>

      {/* Mode A: Direct Local File (0-Second Wait, 0 Storage Overhead) */}
      {uploadMode === 'local' && (
        <div className="bg-white rounded-2xl p-6 border border-[#90CAF9]/60 shadow-sm flex flex-col gap-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="w-5 h-5 text-[#2196F3]" />
              <h3 className="text-base font-bold text-[#0D47A1]">Select Video File Directly on your Mac</h3>
            </div>
            <p className="text-xs text-slate-600">
              Because VideoTimmer runs locally on your Mac, it slices your video directly from its existing location without transferring or copying gigabytes.
            </p>
          </div>

          {/* Direct Path Input */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-[#0D47A1]">Enter or Paste Absolute Video Path:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localPathInput}
                onChange={(e) => setLocalPathInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleProbeLocalPath()}
                placeholder="e.g. /Users/username/Downloads/movie.mp4 or ~/Movies/podcast.mp4"
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#2196F3] text-xs font-mono"
              />
              <button
                type="button"
                disabled={isProbingLocal || !localPathInput.trim()}
                onClick={() => handleProbeLocalPath()}
                className="btn-pressable flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#2196F3] hover:bg-[#1E88E5] text-white font-bold text-xs shadow-md shadow-[#2196F3]/25 disabled:opacity-50 shrink-0"
              >
                {isProbingLocal ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Inspecting...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>Load Instantly</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Folder Shortcuts & File Browser */}
          <div className="p-4 rounded-xl bg-[#F0F7FF] border border-[#90CAF9]/60 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#0D47A1] flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-[#2196F3]" /> Quick Mac Folder Presets
              </span>

              {/* Preset Buttons */}
              <div className="flex items-center gap-1.5 text-xs">
                {[
                  { id: 'workspace', label: 'Workspace' },
                  { id: 'downloads', label: 'Downloads' },
                  { id: 'movies', label: 'Movies' },
                  { id: 'desktop', label: 'Desktop' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFolderPreset(f.id as any)}
                    className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                      activeFolderPreset === f.id
                        ? 'bg-[#2196F3] text-white shadow-sm'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Folder Video List */}
            {isLoadingFolder ? (
              <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2196F3]" />
                <span>Scanning {activeFolderPreset}...</span>
              </div>
            ) : folderVideos.length === 0 ? (
              <div className="p-4 rounded-lg bg-white border border-slate-200 text-center text-[11px] text-slate-500">
                No video files (.mp4, .mov, .mkv) found in {activeFolderPreset}. Paste your exact path above or pick another folder.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {folderVideos.map((v) => (
                  <button
                    key={v.fullPath}
                    onClick={() => {
                      setLocalPathInput(v.fullPath);
                      handleProbeLocalPath(v.fullPath);
                    }}
                    className="p-2.5 rounded-lg bg-white border border-slate-200 hover:border-[#2196F3] hover:bg-white/90 text-left transition-all flex items-center justify-between group shadow-2xs"
                  >
                    <div className="truncate max-w-[220px]">
                      <p className="text-xs font-bold text-slate-800 truncate group-hover:text-[#0D47A1]">
                        {v.name}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {v.sizeFormatted} &bull; {v.modifiedAt}
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#2196F3] group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 font-medium pt-2 border-t border-slate-100">
            <span className="flex items-center gap-1 text-emerald-700 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Zero upload wait time
            </span>
            <span className="flex items-center gap-1 text-emerald-700 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Zero duplicate disk storage
            </span>
            <span className="flex items-center gap-1 text-emerald-700 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Preserves 100% original quality
            </span>
          </div>
        </div>
      )}

      {/* Mode B: Chunked Upload Dropzone */}
      {uploadMode === 'chunked' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`bg-white rounded-2xl p-8 flex flex-col items-center justify-center text-center border-dashed border-2 transition-all min-h-[360px] relative shadow-sm ${
            isDragging
              ? 'border-[#2196F3] bg-[#E3F2FD] scale-[1.01]'
              : 'border-[#90CAF9] hover:border-[#2196F3] hover:bg-[#F0F7FF]/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.mov,.mkv,.webm,.avi,.m4v,video/*"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={uploading}
          />

          {!uploading ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-[#E3F2FD] border border-[#90CAF9] flex items-center justify-center text-[#2196F3] mb-4 shadow-sm group-hover:scale-105 transition-all">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-extrabold text-[#0D47A1] mb-1">Upload Source Video</h3>
              <p className="text-xs text-slate-600 max-w-sm mb-5 leading-relaxed font-medium">
                Drag &amp; drop your video here, or browse from your computer. Supports MP4, MOV, MKV, WebM, AVI up to 2GB.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-pressable inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2196F3] hover:bg-[#1E88E5] text-white font-bold text-xs shadow-md shadow-[#2196F3]/25"
              >
                Browse Files
              </button>
            </>
          ) : (
            <div className="w-full max-w-md flex flex-col gap-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#0D47A1] truncate max-w-[240px]">
                  {currentFile?.name}
                </span>
                <span className="text-[#2196F3] font-mono font-bold">{progress}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#E3F2FD] h-3 rounded-full overflow-hidden border border-[#90CAF9]">
                <div
                  className="bg-[#2196F3] h-full rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono font-semibold">
                <span>Speed: {speedMb} MB/s</span>
                <span>ETA: {etaSec}s remaining</span>
              </div>

              <div className="flex justify-center pt-2">
                <button
                  onClick={cancelUpload}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-semibold transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel Upload
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
