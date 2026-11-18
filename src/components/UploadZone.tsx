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
  Sliders,
  FolderSync,
  Eye,
  ExternalLink,
  Sparkles,
  Download,
} from 'lucide-react';
import { CustomSelect, SelectOption } from './ui/CustomSelect';
import { safeFetchJson } from '@/lib/safeJson';
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

interface DriveVideoItem {
  id: string;
  name: string;
  sizeBytes: number;
  sizeFormatted: string;
  webViewLink: string;
  thumbnailLink?: string;
  createdTime: string;
  durationSec?: number;
  mimeType?: string;
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk

export function UploadZone({ onUploadComplete, onReset, onProceed }: UploadZoneProps) {
  // Mode: 'drive' (Google Drive) | 'local' (Mac quick folders) | 'chunked' (traditional upload)
  const [uploadMode, setUploadMode] = useState<'drive' | 'local' | 'chunked'>('drive');
  const [showTechDetails, setShowTechDetails] = useState<boolean>(false);

  // Google Drive state
  const [driveVideos, setDriveVideos] = useState<DriveVideoItem[]>([]);
  const [driveFolders, setDriveFolders] = useState<SelectOption[]>([]);
  const [selectedDriveFolder, setSelectedDriveFolder] = useState<string>('default');
  const [driveSearch, setDriveSearch] = useState<string>('');
  const [isLoadingDrive, setIsLoadingDrive] = useState<boolean>(false);
  const [downloadingDriveId, setDownloadingDriveId] = useState<string | null>(null);
  const [driveDownloadNotice, setDriveDownloadNotice] = useState<string | null>(null);
  const [driveAuthError, setDriveAuthError] = useState<string | null>(null);

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
    isCached?: boolean;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeUploadIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Google Drive videos
  const fetchDriveVideos = useCallback(async (folderId?: string, search?: string) => {
    setIsLoadingDrive(true);
    setDriveAuthError(null);
    try {
      const params = new URLSearchParams();
      if (folderId && folderId !== 'default') params.append('folderId', folderId);
      if (search && search.trim()) params.append('search', search.trim());

      const res = await fetch(`/api/drive/videos?${params.toString()}`);
      const { ok, data } = await safeFetchJson<{
        success: boolean;
        error?: string;
        videos?: DriveVideoItem[];
        folders?: Array<{ id: string; name: string }>;
      }>(res);

      if (ok && data?.success) {
        setDriveVideos(data.videos || []);
        if (data.folders && data.folders.length > 0) {
          const folderOpts: SelectOption[] = data.folders.map((f) => ({
            value: f.id,
            label: f.name,
            description: f.id === 'root' ? 'Google Drive root directory' : `Folder ID: ${f.id.slice(0, 10)}...`,
          }));
          setDriveFolders(folderOpts);
        }
      } else {
        setDriveAuthError(data?.error || 'Could not load Google Drive videos.');
        setDriveVideos([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDriveAuthError(msg);
      setDriveVideos([]);
    } finally {
      setIsLoadingDrive(false);
    }
  }, []);

  // Download video from Google Drive to local cache and probe
  const handleSelectDriveVideo = async (video: DriveVideoItem) => {
    try {
      setErrorMessage(null);
      setDownloadingDriveId(video.id);
      setDriveDownloadNotice(`Preparing "${video.name}" from Google Drive...`);

      const res = await fetch('/api/drive/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: video.id, fileName: video.name }),
      });

      const { ok, data, error } = await safeFetchJson<any>(res);
      if (!ok || !data?.success) {
        throw new Error(error || data?.error || 'Failed to download video from Google Drive.');
      }

      setDriveDownloadNotice(
        data.isCached
          ? 'Local cache verified (0s wait). Probing video streams...'
          : 'Download complete. Probing video streams with ffprobe...'
      );

      setUploadedData(data);
      onUploadComplete(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setDownloadingDriveId(null);
      setDriveDownloadNotice(null);
    }
  };

  // Load videos for active local folder preset
  const loadFolderVideos = useCallback(async (preset: string) => {
    try {
      setIsLoadingFolder(true);
      const res = await fetch(`/api/fs/quick-browse?folder=${preset}`);
      const { ok, data } = await safeFetchJson<{ success: boolean; videos?: LocalVideoItem[] }>(res);
      if (ok && data?.success) {
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
    if (uploadMode === 'drive') {
      fetchDriveVideos(selectedDriveFolder, driveSearch);
    } else if (uploadMode === 'local') {
      loadFolderVideos(activeFolderPreset);
    }
  }, [uploadMode, selectedDriveFolder, fetchDriveVideos, loadFolderVideos, activeFolderPreset]);

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

      const { ok, data, error } = await safeFetchJson<any>(res);
      if (!ok || !data?.success) {
        throw new Error(error || data?.error || 'Failed to inspect local video file.');
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

      const { ok: initOk, data: initData, error: initErr } = await safeFetchJson<any>(initRes);
      if (!initOk || !initData?.uploadId) {
        throw new Error(initErr || initData?.error || 'Failed to initiate upload session.');
      }

      const uploadId = initData.uploadId;
      activeUploadIdRef.current = uploadId;

      // 2. Upload chunks with tracking
      let bytesUploaded = 0;
      const startTime = Date.now();

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (abortController.signal.aborted) {
          throw new Error('Upload aborted by user.');
        }

        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalSize);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('chunk', chunk);

        const chunkRes = await fetch('/api/upload/chunk', {
          method: 'POST',
          body: formData,
          signal: abortController.signal,
        });

        if (!chunkRes.ok) {
          const { error } = await safeFetchJson<any>(chunkRes);
          throw new Error(error || `Failed uploading chunk ${chunkIndex + 1}/${totalChunks}`);
        }

        bytesUploaded += chunk.size;
        const percent = Math.round((bytesUploaded / totalSize) * 100);
        setProgress(percent);

        const elapsedSec = (Date.now() - startTime) / 1000;
        if (elapsedSec > 0.5) {
          const currentSpeed = (bytesUploaded / (1024 * 1024)) / elapsedSec;
          setSpeedMb(Number(currentSpeed.toFixed(1)));
          const remainingBytes = totalSize - bytesUploaded;
          setEtaSec(Math.round(remainingBytes / (bytesUploaded / elapsedSec)));
        }
      }

      // 3. Finalize upload & run probe
      const completeRes = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId }),
        signal: abortController.signal,
      });

      const { ok: compOk, data: compData, error: compErr } = await safeFetchJson<any>(completeRes);
      if (!compOk || !compData?.success) {
        throw new Error(compErr || compData?.error || 'Failed to assemble video file on server.');
      }

      setUploadedData(compData);
      onUploadComplete(compData);
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setUploading(false);
      abortControllerRef.current = null;
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      const videoFile = droppedFiles.find((f) => f.type.startsWith('video/') || /\.(mp4|mov|mkv|webm)$/i.test(f.name));
      if (videoFile) {
        startChunkedUpload(videoFile);
      } else {
        setErrorMessage('Please drop a valid video file (MP4, MOV, MKV, WebM).');
      }
    },
    []
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      startChunkedUpload(selected);
    }
  };

  const handleAbort = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const uploadId = activeUploadIdRef.current;
    if (uploadId) {
      try {
        await fetch('/api/upload/abort', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId }),
        });
      } catch {}
    }
    setUploading(false);
    setProgress(0);
    setCurrentFile(null);
  };

  const handleReset = () => {
    setUploadedData(null);
    setCurrentFile(null);
    setProgress(0);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onReset?.();
  };

  // ----------------------------------------------------
  // VIEW A: PROBED VIDEO RESULT (READY FOR CLIPPING)
  // ----------------------------------------------------
  if (uploadedData) {
    const probe = uploadedData.probe;
    const formatDuration = (seconds?: number) => {
      if (!seconds || isNaN(seconds)) return '00:00';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const streamVideoUrl = uploadedData.sanitizedFilename
      ? `/api/video/${uploadedData.uploadId}?filePath=${encodeURIComponent(uploadedData.sanitizedFilename)}`
      : `/api/video/${uploadedData.uploadId}`;

    return (
      <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col gap-5 backdrop-blur-md">
        {/* Header with Source Badge & Change Video Button */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Video Ready for Clipping</h3>
                {uploadedData.isCached ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    Local Cache Hit
                  </span>
                ) : uploadedData.isDirectLocal ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    Local Direct File
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    Direct Upload
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono truncate max-w-md mt-0.5">
                {uploadedData.originalFilename}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Select Another Clip</span>
          </button>
        </div>

        {/* Video Player & Probed Specs Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Video Preview Player */}
          <div className="lg:col-span-5 bg-slate-950 rounded-xl overflow-hidden border border-slate-800/80 flex items-center justify-center relative min-h-[220px]">
            <video
              src={streamVideoUrl}
              controls
              playsInline
              className="w-full max-h-[300px] object-contain"
            />
          </div>

          {/* Video Specs Breakdown */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  Duration
                </span>
                <span className="text-base font-bold text-white font-mono mt-0.5">
                  {formatDuration(probe?.duration)}
                </span>
                <span className="text-[10px] text-slate-400">Total Playtime</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                  <Maximize className="w-3.5 h-3.5 text-indigo-400" />
                  Resolution
                </span>
                <span className="text-base font-bold text-white font-mono mt-0.5">
                  {probe ? `${probe.displayWidth}x${probe.displayHeight}` : 'Probing...'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {probe
                    ? probe.displayWidth > probe.displayHeight
                      ? '16:9 Landscape'
                      : probe.displayWidth < probe.displayHeight
                      ? '9:16 Vertical'
                      : '1:1 Square'
                    : ''}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                  File Size
                </span>
                <span className="text-base font-bold text-white font-mono mt-0.5">
                  {(uploadedData.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold">Ready to split</span>
              </div>
            </div>

            {/* AI Subtitle & Timestamp Readiness Banner */}
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-purple-200">AI Subtitle Pipeline Ready: </span>
                <span className="text-purple-300">
                  Audio stream is verified locally for exact timestamp extraction and Gemini AI captioning.
                </span>
              </div>
            </div>

            {/* Technical Stream Specs Toggle */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowTechDetails(!showTechDetails)}
                className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-slate-300 hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-sky-400" />
                  <span>Technical Stream Specs (Codec, Framerate, Audio)</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${showTechDetails ? 'rotate-180' : ''}`} />
              </button>

              {showTechDetails && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 pt-2 border-t border-slate-800/80 bg-slate-950/80 text-xs font-mono">
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 block">Codec</span>
                    <span className="font-bold text-white uppercase">{probe?.videoCodec || 'H.264'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 block">Framerate</span>
                    <span className="font-bold text-white">{probe ? `${probe.fps} fps` : 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 block">Audio</span>
                    <span className="font-bold text-white">
                      {probe?.hasAudio ? `${probe.audioCodec?.toUpperCase()} (${probe.audioChannels}ch)` : 'Silent'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 block">Bitrate</span>
                    <span className="font-bold text-white">
                      {probe?.bitrate ? `${Math.round(probe.bitrate / 1000)} kbps` : 'Auto'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Direct Proceed to Framing CTA */}
            {onProceed && (
              <button
                type="button"
                onClick={onProceed}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all"
              >
                <span>Continue to Framing &amp; Cuts</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW B: MEDIA SELECTION (DRIVE | LOCAL | UPLOAD)
  // ----------------------------------------------------
  return (
    <div className="flex flex-col gap-4">
      {/* 3-Way Mode Switcher */}
      <div className="bg-slate-900/90 rounded-2xl p-1.5 border border-slate-800 shadow-xl flex flex-wrap items-center gap-1.5 self-start backdrop-blur-md">
        <button
          type="button"
          onClick={() => setUploadMode('drive')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            uploadMode === 'drive'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FolderSync className="w-3.5 h-3.5 text-sky-300" />
          <span>Google Drive</span>
          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-sky-400/20 text-sky-200 border border-sky-400/30">
            Cloud Library
          </span>
        </button>

        <button
          type="button"
          onClick={() => setUploadMode('local')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            uploadMode === 'local'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5 text-amber-300" />
          <span>Mac Quick Folders</span>
          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 border border-amber-400/30">
            Direct Path
          </span>
        </button>

        <button
          type="button"
          onClick={() => setUploadMode('chunked')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            uploadMode === 'chunked'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Manual Upload</span>
        </button>
      </div>

      {/* Error Message Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODE 1: GOOGLE DRIVE (CLOUD BROWSER)                  */}
      {/* ---------------------------------------------------- */}
      {uploadMode === 'drive' && (
        <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col gap-5 backdrop-blur-md">
          {/* Header & Controls Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <FolderSync className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-bold text-white">Select Video from Google Drive</h3>
              </div>
              <p className="text-xs text-slate-400">
                Videos are streamed and cached locally on your Mac for rapid splitting, framing, and subtitle processing.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchDriveVideos(selectedDriveFolder, driveSearch)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                title="Refresh Google Drive files"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isLoadingDrive ? 'animate-spin text-sky-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Drive Auth Error Banner */}
          {driveAuthError && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{driveAuthError}</span>
              </div>
              <a
                href="/?tab=settings"
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs whitespace-nowrap transition-all shadow-md"
              >
                Open Drive Settings
              </a>
            </div>
          )}

          {/* Folder Filter & Search Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5">
              <CustomSelect
                options={driveFolders.length > 0 ? driveFolders : [{ value: 'default', label: 'Default Target Folder' }]}
                value={selectedDriveFolder}
                onChange={(val) => {
                  setSelectedDriveFolder(val);
                }}
              />
            </div>

            <div className="sm:col-span-7 relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={driveSearch}
                onChange={(e) => setDriveSearch(e.target.value)}
                placeholder="Filter Drive videos by title..."
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono transition-all"
              />
            </div>
          </div>

          {/* Download in progress notice */}
          {driveDownloadNotice && (
            <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs flex items-center gap-2.5 animate-pulse">
              <RotateCw className="w-4 h-4 animate-spin text-sky-400 shrink-0" />
              <span className="font-medium">{driveDownloadNotice}</span>
            </div>
          )}

          {/* Drive Video Items Grid */}
          <div className="flex flex-col gap-2 max-h-[460px] overflow-y-auto pr-1">
            {isLoadingDrive && driveVideos.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <RotateCw className="w-5 h-5 animate-spin text-sky-400" />
                <span>Scanning Google Drive folder...</span>
              </div>
            )}

            {!isLoadingDrive && driveVideos.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <FolderSync className="w-7 h-7 text-slate-600" />
                <span>No video files found matching current folder or search filter.</span>
              </div>
            )}

            {driveVideos.map((vid) => {
              const isDownloading = downloadingDriveId === vid.id;
              const ext = vid.name.split('.').pop()?.toUpperCase() || 'VIDEO';

              return (
                <div
                  key={vid.id}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-sky-500/50 flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-mono text-[10px] font-bold shrink-0">
                      {ext.slice(0, 4)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate max-w-sm sm:max-w-md">{vid.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                        <span>{vid.sizeFormatted}</span>
                        {vid.durationSec && (
                          <>
                            <span>&bull;</span>
                            <span>{Math.floor(vid.durationSec / 60)}m {vid.durationSec % 60}s</span>
                          </>
                        )}
                        <span>&bull;</span>
                        <span>{new Date(vid.createdTime).toLocaleDateString()}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Eye Preview Button (Opens Drive Preview) */}
                    <a
                      href={vid.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-sky-300 border border-slate-700 transition-all flex items-center gap-1.5 text-xs font-semibold"
                      title="Inspect Video in Google Drive"
                    >
                      <Eye className="w-3.5 h-3.5 text-sky-400" />
                      <span className="hidden sm:inline">Preview</span>
                    </a>

                    {/* Import & Clip Button */}
                    <button
                      type="button"
                      onClick={() => handleSelectDriveVideo(vid)}
                      disabled={isDownloading || Boolean(downloadingDriveId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20 transition-all disabled:opacity-40"
                    >
                      {isDownloading ? (
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>{isDownloading ? 'Importing...' : 'Import & Clip'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODE 2: DIRECT LOCAL FILE (0-WAIT ON MAC)             */}
      {/* ---------------------------------------------------- */}
      {uploadMode === 'local' && (
        <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col gap-5 backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-white">Select Video File Directly on your Mac</h3>
            </div>
            <p className="text-xs text-slate-400">
              Because VideoTimmer runs locally on your Mac, it slices your video directly from its existing location without transferring gigabytes.
            </p>
          </div>

          {/* Direct Path Input */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-300">Enter or Paste Absolute Video Path:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localPathInput}
                onChange={(e) => setLocalPathInput(e.target.value)}
                placeholder="/Users/username/Movies/sample_video.mp4"
                className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono transition-all"
              />
              <button
                type="button"
                onClick={() => handleProbeLocalPath()}
                disabled={isProbingLocal || !localPathInput.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20 transition-all disabled:opacity-40"
              >
                {isProbingLocal ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>Inspect Video</span>
              </button>
            </div>
          </div>

          {/* Quick Folders Browser */}
          <div className="flex flex-col gap-3 pt-4 border-t border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-amber-400" />
                Quick Browse Local Mac Folders:
              </span>
              <div className="flex items-center gap-1.5">
                {(['workspace', 'downloads', 'movies', 'desktop'] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setActiveFolderPreset(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                      activeFolderPreset === preset
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Folder Videos List */}
            <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
              {isLoadingFolder && (
                <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <RotateCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Scanning folder...</span>
                </div>
              )}

              {!isLoadingFolder && folderVideos.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-500">
                  No video files found in selected Mac folder.
                </div>
              )}

              {folderVideos.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 hover:border-amber-500/40 transition-all"
                >
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white truncate max-w-sm sm:max-w-md">{item.name}</h4>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {item.sizeFormatted} &bull; {new Date(item.modifiedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleProbeLocalPath(item.fullPath)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/20 transition-all"
                  >
                    <Play className="w-3 h-3" />
                    <span>Select Clip</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODE 3: TRADITIONAL CHUNKED UPLOAD                   */}
      {/* ---------------------------------------------------- */}
      {uploadMode === 'chunked' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`bg-slate-900/90 rounded-2xl p-10 border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-3 backdrop-blur-md ${
            isDragging
              ? 'border-indigo-500 bg-indigo-500/10'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/*,.mp4,.mov,.mkv,.webm"
            className="hidden"
          />

          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <UploadCloud className="w-7 h-7" />
          </div>

          <div className="text-center">
            <h4 className="text-sm font-bold text-white">Click to browse or drag &amp; drop video file</h4>
            <p className="text-xs text-slate-400 mt-1">Supports MP4, MOV, MKV, WebM up to 50 GB</p>
          </div>

          {/* Active Uploading Progress Bar */}
          {uploading && currentFile && (
            <div className="w-full max-w-md flex flex-col gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="truncate max-w-[200px] font-mono">{currentFile.name}</span>
                <span className="font-mono font-bold text-indigo-400">{progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-sky-500 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>{speedMb} MB/s</span>
                <span>ETA: {etaSec}s</span>
              </div>
              <button
                type="button"
                onClick={handleAbort}
                className="self-center mt-2 px-3 py-1 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-all"
              >
                Cancel Upload
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
