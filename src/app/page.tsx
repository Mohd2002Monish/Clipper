'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Film,
  Layers,
  History,
  Settings,
  Activity,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Cpu,
  Database,
  ArrowRight,
  ArrowLeft,
  UploadCloud,
  Split,
  Type,
  FolderSync,
  Play,
  RotateCw,
  Info,
  ShieldCheck,
  Download,
  Check,
  Sliders,
  Sparkles,
  Trash2,
  X,
  Smartphone,
  Zap,
  Tv,
  Folder,
  Square,
  Youtube,
  Eye,
  ChevronDown,
  ChevronUp,
  Scissors,
  Video,
  AtSign,
  Clock,
  BarChart3,
  FileText,
  Instagram,
  Terminal,
  Scan,
  AlignCenter,
  AlignLeft,
  AlignRight,
} from 'lucide-react';
import { UploadZone } from '@/components/UploadZone';
import { PartsTable } from '@/components/PartsTable';
import { PreviewCanvas } from '@/components/PreviewCanvas';
import { TextOverlayEditor } from '@/components/TextOverlayEditor';
import { JobProgressView } from '@/components/JobProgressView';
import { JobHistoryView } from '@/components/JobHistoryView';
import { SettingsLogsView } from '@/components/SettingsLogsView';
import { FolderSelector } from '@/components/FolderSelector';
import { Sidebar, TabType } from '@/components/Sidebar';
import { YouTubePublisherView } from '@/components/YouTubePublisherView';
import { YouTubeUploadedVideosView } from '@/components/YouTubeUploadedVideosView';
import { ThreadsPublisherView } from '@/components/ThreadsPublisherView';
import { InstagramPublisherView } from '@/components/InstagramPublisherView';
import { WaterfallSyndicationView } from '@/components/WaterfallSyndicationView';
import { VideoProbeData, IJob } from '@/shared/types';
import { PartPlan, TextOverlaySettings } from '@/shared/schemas';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { NoticeModal } from '@/components/ui/NoticeModal';

interface HealthData {
  status: string;
  durationMs: number;
  services: {
    ffmpeg: { available: boolean; version?: string; error?: string };
    ffprobe: { available: boolean; version?: string; error?: string };
    mongo: { connected: boolean; error?: string };
    redis: { connected: boolean; latencyMs?: number; error?: string };
    disk: { isSpaceAvailable: boolean; freeBytes?: number; usagePercent?: number };
    googleDrive: { configured: boolean; defaultFolderIdSet: boolean };
  };
  system: {
    uptimeSeconds: number;
    memory: { usedPercent: number };
  };
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabType>('new-job');
  const [health, setHealth] = useState<HealthData | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(true);



  // Notice modal state replacing alert()
  const [notice, setNotice] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
  }>({
    isOpen: false,
    message: '',
  });

  // Active Job in Queue
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJobsList, setActiveJobsList] = useState<IJob[]>([]);

  // Uploaded video state
  const [uploadedVideo, setUploadedVideo] = useState<{
    uploadId: string;
    originalFilename: string;
    sanitizedFilename: string;
    sizeBytes: number;
    probe?: VideoProbeData;
  } | null>(null);

  // Wizard state for Steps A-E (Streamlined 5-step flow)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [showSplitAdvanced, setShowSplitAdvanced] = useState<boolean>(false);
  const [selectedRatio, setSelectedRatio] = useState<'9:16' | '1:1' | '4:5' | '16:9'>('9:16');
  const [reframeMode, setReframeMode] = useState<'blur' | 'solid' | 'crop'>('blur');
  const [focalPoint, setFocalPoint] = useState<'left' | 'center' | 'right' | 'auto_face'>('auto_face');
  const [resolution, setResolution] = useState<'1080p' | '720p' | 'original'>('1080p');
  const [showSafeZone, setShowSafeZone] = useState<boolean>(true);

  // Step C Split Settings state
  const [splitMode, setSplitMode] = useState<'fixed' | 'parts' | 'custom' | 'ai_highlights'>('fixed');
  const [fixedLength, setFixedLength] = useState<number>(60);
  const [numberOfParts, setNumberOfParts] = useState<number>(5);
  const [overlapSeconds, setOverlapSeconds] = useState<number>(0);
  const [minLastPartSeconds, setMinLastPartSeconds] = useState<number>(5);
  const [lastPartAction, setLastPartAction] = useState<'merge' | 'keep'>('merge');
  const [customTimestamps, setCustomTimestamps] = useState<Array<{ id: string; start: number; end: number }>>([
    { id: '1', start: 0, end: 30 },
    { id: '2', start: 30, end: 60 },
  ]);
  const [aiClips, setAiClips] = useState<Array<{
    id: string;
    start: number;
    end: number;
    hookHeadline: string;
    viralScore: number;
    reasoning?: string;
  }>>([]);
  const [isDetectingHighlights, setIsDetectingHighlights] = useState<boolean>(false);
  const [aiMaxClips, setAiMaxClips] = useState<number>(5);
  const [aiTargetDuration, setAiTargetDuration] = useState<number>(50);

  // Step D Text Overlays state
  const [textOverlaySettings, setTextOverlaySettings] = useState<TextOverlaySettings>({
    top: {
      enabled: false,
      mode: 'same',
      text: 'Part {part}/{total} • {title}',
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
    },
    bottom: {
      enabled: false,
      mode: 'same',
      text: 'Follow for more updates',
      perPartTexts: [],
      fontFamily: 'Noto Sans',
      fontSize: 32,
      fontColor: '#FFFFFF',
      outlineColor: '#000000',
      outlineWidth: 3,
      bgBoxEnabled: true,
      bgBoxColor: '#000000',
      bgBoxOpacity: 0.65,
      alignment: 'center',
      margin: 40,
      maxLines: 2,
      durationMode: 'full',
      durationSeconds: 5,
    },
    showSafeZoneGuide: true,
    themePreset: 'tiktok-viral',
  });

  // Step E Destination & Output Settings state
  const [selectedFolder, setSelectedFolder] = useState<string>('General');
  const [filenameTemplate, setFilenameTemplate] = useState<string>('{title}_part{nn}');
  const [qualityPreset, setQualityPreset] = useState<'fast' | 'balanced' | 'high'>('balanced');
  const [destination, setDestination] = useState<'drive' | 'local'>('local');
  const [driveFolderId, setDriveFolderId] = useState<string>('');
  const [createSubfolder, setCreateSubfolder] = useState<boolean>(true);
  const [onConflict, setOnConflict] = useState<'rename' | 'overwrite' | 'skip'>('rename');

  // Job Submission State
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Computed parts plan state
  const [computedPlan, setComputedPlan] = useState<PartPlan[]>([]);
  const [planWarnings, setPlanWarnings] = useState<string[]>([]);
  const [planAdjustments, setPlanAdjustments] = useState<string[]>([]);
  const [planError, setPlanError] = useState<string | null>(null);

  const [isCleaningStorage, setIsCleaningStorage] = useState(false);
  const [storageCleanMessage, setStorageCleanMessage] = useState<string | null>(null);

  const handleCleanStorage = async () => {
    try {
      setIsCleaningStorage(true);
      const res = await fetch('/api/storage/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cleanSessions: true, cleanWork: true, cleanUploads: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setStorageCleanMessage(data.message || 'Storage cleaned successfully!');
        await fetchHealth();
      } else {
        setStorageCleanMessage(data.error || 'Failed to clean storage.');
      }
    } catch (err: unknown) {
      setStorageCleanMessage(err instanceof Error ? err.message : 'Error cleaning storage.');
    } finally {
      setIsCleaningStorage(false);
      setTimeout(() => setStorageCleanMessage(null), 5000);
    }
  };

  const fetchHealth = async () => {
    try {
      setIsHealthLoading(true);
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
      if (data?.services?.googleDrive?.configured) {
        setDestination('drive');
      }
    } catch {
      // Dev boot catch
    } finally {
      setIsHealthLoading(false);
    }
  };

  const fetchActiveJobs = async () => {
    try {
      const res = await fetch('/api/jobs?limit=5&status=processing');
      if (res.ok) {
        const data = await res.json();
        setActiveJobsList(data.jobs || []);
        if (!activeJobId && data.jobs?.length > 0) {
          setActiveJobId(String(data.jobs[0]._id));
        }
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as TabType;
      if (
        tabParam &&
        [
          'new-job',
          'queue',
          'history',
          'youtube',
          'uploaded-videos',
          'threads-composer',
          'threads-posts',
          'threads-analytics',
          'threads-mcp',
          'instagram-composer',
          'instagram-posts',
          'instagram-analytics',
          'settings',
        ].includes(tabParam)
      ) {
        setActiveTab(tabParam);
      } else if (params.get('youtube') === 'connected') {
        setActiveTab('youtube');
      }
    }
    fetchHealth();
    fetchActiveJobs();
    const interval = setInterval(() => {
      fetchHealth();
      fetchActiveJobs();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const recomputePlan = useCallback(async () => {
    const duration = uploadedVideo?.probe?.duration || 300;
    const filename = uploadedVideo?.originalFilename || 'my_video.mp4';

    try {
      setPlanError(null);
      const res = await fetch('/api/plan/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceDuration: duration,
          originalFilename: filename,
          splitSettings: {
            mode: splitMode,
            fixedLengthSeconds: fixedLength,
            numberOfParts,
            customTimestamps,
            aiClips,
            targetClipDurationSec: aiTargetDuration,
            overlapSeconds,
            minLastPartSeconds,
            lastPartAction,
            maxPartsLimit: 10000,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to compute split plan');
      }

      const data = await res.json();
      setComputedPlan(data.plan || []);
      setPlanWarnings(data.warnings || []);
      setPlanAdjustments(data.adjustments || []);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setPlanError(errorMsg);
    }
  }, [
    uploadedVideo,
    splitMode,
    fixedLength,
    numberOfParts,
    customTimestamps,
    aiClips,
    aiTargetDuration,
    overlapSeconds,
    minLastPartSeconds,
    lastPartAction,
  ]);

  useEffect(() => {
    recomputePlan();
  }, [recomputePlan]);

  const doesSourceMatchTarget = () => {
    if (!uploadedVideo?.probe) return false;
    const { displayWidth, displayHeight } = uploadedVideo.probe;
    const sourceRatio = displayWidth / displayHeight;

    let targetRatio = 9 / 16;
    if (selectedRatio === '1:1') targetRatio = 1.0;
    else if (selectedRatio === '4:5') targetRatio = 4 / 5;
    else if (selectedRatio === '16:9') targetRatio = 16 / 9;

    return Math.abs(sourceRatio - targetRatio) < 0.05;
  };

  const addCustomRow = () => {
    const lastRow = customTimestamps[customTimestamps.length - 1];
    const newStart = lastRow ? lastRow.end : 0;
    const newEnd = newStart + 30;
    setCustomTimestamps([
      ...customTimestamps,
      { id: String(Date.now()), start: newStart, end: newEnd },
    ]);
  };

  const removeCustomRow = (id: string) => {
    setCustomTimestamps(customTimestamps.filter((r) => r.id !== id));
  };

  const updateCustomRow = (id: string, field: 'start' | 'end', val: number) => {
    setCustomTimestamps(
      customTimestamps.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    );
  };

  // Detect AI Highlights handler
  const handleDetectAIHighlights = async () => {
    if (!uploadedVideo?.sanitizedFilename) {
      setNotice({
        isOpen: true,
        title: 'Video Required',
        message: 'Please upload a video in Step 1 before running AI Highlight detection.',
        type: 'warning',
      });
      return;
    }

    try {
      setIsDetectingHighlights(true);
      setPlanError(null);
      const res = await fetch('/api/video/ai-highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFilename: uploadedVideo.sanitizedFilename,
          maxClips: aiMaxClips,
          targetDuration: aiTargetDuration,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to analyze viral moments.');
      }

      const data = await res.json();
      const detected = data.clips || [];
      setAiClips(detected);

      // Pre-populate perPartTexts in top text overlay
      if (detected.length > 0) {
        setTextOverlaySettings((prev) => ({
          ...prev,
          top: {
            ...prev.top,
            enabled: true,
            mode: 'different',
            perPartTexts: detected.map((c: any) => c.hookHeadline),
          },
        }));
      }

      setNotice({
        isOpen: true,
        title: 'AI Viral Moments Ready',
        message: `Successfully detected ${detected.length} standalone highlight clips using ${data.engineUsed === 'ollama' ? 'Local Ollama (' + data.model + ')' : data.model}.`,
        type: 'success',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({
        isOpen: true,
        title: 'Highlight Detection Failed',
        message: msg,
        type: 'error',
      });
    } finally {
      setIsDetectingHighlights(false);
    }
  };

  const removeAiClip = (clipId: string) => {
    setAiClips((prev) => prev.filter((c) => c.id !== clipId));
  };

  // Submit Job to BullMQ Worker Queue
  const handleStartProcessing = async () => {
    if (!uploadedVideo) {
      setNotice({
        isOpen: true,
        title: 'Video Required',
        message: 'Please upload a video file first before proceeding.',
        type: 'warning',
      });
      setCurrentStep(1);
      return;
    }

    try {
      setIsSubmittingJob(true);
      setSubmitError(null);

      const payload = {
        sourceFileId: uploadedVideo.sanitizedFilename,
        originalFilename: uploadedVideo.originalFilename,
        folderName: selectedFolder || 'General',
        outputFormat: {
          aspectRatio: selectedRatio,
          resolution,
          reframeMode,
          backgroundColor: '#000000',
          focalPoint,
          filenameTemplate,
          qualityPreset,
          destination,
          folderName: selectedFolder || 'General',
          driveFolderId: driveFolderId || undefined,
          createSubfolder,
          onConflict,
        },
        splitSettings: {
          mode: splitMode,
          fixedLengthSeconds: fixedLength,
          numberOfParts,
          customTimestamps,
          aiClips,
          targetClipDurationSec: aiTargetDuration,
          overlapSeconds,
          minLastPartSeconds,
          lastPartAction,
          maxPartsLimit: 10000,
        },
        textOverlay: textOverlaySettings,
        aiSubtitles: { enabled: false, subtitles: [] },
      };

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit render job.');
      }

      const data = await res.json();
      setActiveJobId(data.jobId);
      setActiveTab('queue');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setSubmitError(errorMsg);
    } finally {
      setIsSubmittingJob(false);
    }
  };

  // Duplicate Job Settings handler from Screen 3
  const handleDuplicateJob = (job: IJob) => {
    if (job.settings?.outputFormat) {
      setSelectedRatio((job.settings.outputFormat.aspectRatio as any) || '9:16');
      setReframeMode((job.settings.outputFormat.reframeMode as any) || 'blur');
      setFocalPoint((job.settings.outputFormat.focalPoint as any) || 'auto_face');
      setQualityPreset(job.settings.outputFormat.qualityPreset || 'balanced');
      setFilenameTemplate(job.settings.outputFormat.filenameTemplate || '{title}_part{nn}');
      setDestination(job.settings.outputFormat.destination || 'local');
      setSelectedFolder(job.folderName || (job.settings.outputFormat as any)?.folderName || 'General');
      setCreateSubfolder(job.settings.outputFormat.createSubfolder ?? true);
      setOnConflict(job.settings.outputFormat.onConflict || 'rename');
    }
    if (job.settings?.splitSettings) {
      setSplitMode(job.settings.splitSettings.mode || 'fixed');
      setFixedLength(job.settings.splitSettings.fixedLengthSeconds || 60);
      setNumberOfParts(job.settings.splitSettings.numberOfParts || 5);
      setOverlapSeconds(job.settings.splitSettings.overlapSeconds || 0);
      setMinLastPartSeconds(job.settings.splitSettings.minLastPartSeconds || 5);
      setLastPartAction(job.settings.splitSettings.lastPartAction || 'merge');
      if (job.settings.splitSettings.customTimestamps) {
        setCustomTimestamps(job.settings.splitSettings.customTimestamps);
      }
    }
    if (job.settings?.textOverlay) {
      setTextOverlaySettings(job.settings.textOverlay);
    }

    setActiveTab('new-job');
    setCurrentStep(uploadedVideo ? 2 : 1);
  };

  // Preview computed part 1 filename
  const getSampleFilename = () => {
    const rawTitle = (uploadedVideo?.originalFilename || 'MyVideo').replace(/\.[^/.]+$/, '');
    return filenameTemplate
      .replace(/{title}/g, rawTitle)
      .replace(/{nn}/g, '01')
      .replace(/{part}/g, '1')
      .replace(/{total}/g, String(computedPlan.length || 5)) + '.mp4';
  };

  return (
    <div className="flex min-h-screen w-full bg-[#E3F2FD]/30">
      {/* Permanent Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', tab);
            window.history.pushState({}, '', url.toString());
          }
        }}
        activeJobsCount={activeJobsList.length}
        health={
          health
            ? {
                status: health.status,
                services: {
                  mongo: health.services?.mongo,
                  googleDrive: health.services?.googleDrive,
                },
              }
            : undefined
        }
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 overflow-y-auto">
        {/* Top Navbar */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 mb-6 border-b border-[#90CAF9]/50">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-[#2196F3] flex items-center justify-center shadow-md shadow-[#2196F3]/25 text-white">
              <Film className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-[#0D47A1] flex items-center gap-2">
                VideoTimmer
                <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-[#E3F2FD] text-[#0D47A1] border border-[#90CAF9]">
                  Core v1.2
                </span>
              </h1>
              <p className="text-xs text-slate-600 font-medium">Reframe, Split, Safe Typography, Google Drive & YouTube Dispatcher</p>
            </div>
          </div>



        {/* Health status pill */}
        <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-[#90CAF9]/60 text-xs shadow-sm">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                health?.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                health?.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </span>
          <span className="text-slate-700 font-semibold capitalize">
            {health?.status || (isHealthLoading ? 'Checking...' : 'Offline')}
          </span>
          <button
            onClick={fetchHealth}
            title="Refresh System Health"
            className="text-slate-400 hover:text-[#0D47A1] transition-colors ml-1"
          >
            <RotateCw className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* Sleek System Status Ribbon */}
      <div className="bg-white rounded-2xl p-2.5 px-4 border border-[#90CAF9]/60 shadow-xs flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  health?.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  health?.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
            <span className="text-xs font-bold text-[#0D47A1]">
              Engine {health?.status === 'healthy' ? 'Active' : 'Checking'}
            </span>
          </div>

          <span className="text-slate-300 hidden sm:inline">&bull;</span>

          <div className="hidden sm:flex items-center gap-4 text-xs text-slate-600 font-medium">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#2196F3]" />
              FFmpeg {health?.services.ffmpeg.available ? 'Ready' : 'Offline'}
            </span>
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              Mongo &amp; Redis {health?.services.mongo.connected && health?.services.redis.connected ? 'Connected' : 'Partial'}
            </span>
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
              {formatBytes(health?.services.disk.freeBytes)} Free
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCleanStorage}
            disabled={isCleaningStorage}
            title="Clean temporary files and cache"
            className="btn-pressable flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E3F2FD] hover:bg-[#90CAF9]/30 text-[#0D47A1] border border-[#90CAF9] text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Trash2 className={`w-3 h-3 ${isCleaningStorage ? 'animate-spin' : ''}`} />
            <span>{isCleaningStorage ? 'Cleaning...' : 'Clean Cache'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="p-1 rounded-lg text-slate-400 hover:text-[#0D47A1] hover:bg-[#F0F7FF] transition-all"
            title="Toggle system diagnostic details"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showDiagnostics ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expandable Diagnostic Cards */}
      {showDiagnostics && (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl p-3 border border-[#90CAF9]/60 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#E3F2FD] text-[#2196F3]">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500">FFmpeg Engine</p>
                <p className="text-xs font-bold text-[#0D47A1]">
                  {health?.services.ffmpeg.available ? 'Ready & Active' : 'Not Detected'}
                </p>
              </div>
            </div>
            {health?.services.ffmpeg.available ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            )}
          </div>

          <div className="bg-white rounded-xl p-3 border border-[#90CAF9]/60 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500">Mongo &amp; Redis</p>
                <p className="text-xs font-bold text-[#0D47A1]">
                  {health?.services.mongo.connected && health?.services.redis.connected ? 'All Connected' : 'Partial'}
                </p>
              </div>
            </div>
            {health?.services.mongo.connected && health?.services.redis.connected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            )}
          </div>

          <div className="bg-white rounded-xl p-3 border border-[#90CAF9]/60 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#E3F2FD] text-[#0288D1]">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500">Working Disk</p>
                <p className="text-xs font-bold text-[#0D47A1]">
                  {formatBytes(health?.services.disk.freeBytes)} Available
                </p>
              </div>
            </div>
            <HardDrive className="w-4 h-4 text-slate-400" />
          </div>

          <div className="bg-white rounded-xl p-3 border border-[#90CAF9]/60 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <FolderSync className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500">Google Drive</p>
                <p className="text-xs font-bold text-[#0D47A1]">
                  {health?.services.googleDrive.configured ? 'Connected' : 'Local Fallback'}
                </p>
              </div>
            </div>
            <Info className="w-4 h-4 text-slate-400" />
          </div>
        </section>
      )}

      {/* Storage Clean Notification Banner */}
      {storageCleanMessage && (
        <div className="flex items-center justify-between p-3.5 mb-6 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{storageCleanMessage}</span>
          </div>
          <button onClick={() => setStorageCleanMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Tab Views */}
      {activeTab === 'new-job' && (
        <main className="flex-1 flex flex-col gap-6">
          {/* Streamlined Step Progress Tracker */}
          <div className="bg-white rounded-2xl p-2.5 border border-[#90CAF9]/60 shadow-xs flex items-center justify-between overflow-x-auto gap-2">
            {[
              { num: 1, title: 'Media', desc: 'Select Video', icon: UploadCloud },
              { num: 2, title: 'Framing', desc: 'Aspect Ratio', icon: Film },
              { num: 3, title: 'Clips', desc: 'Duration & Cuts', icon: Scissors },
              { num: 4, title: 'Style', desc: 'Titles & Badges', icon: Type },
              { num: 5, title: 'Export', desc: 'Finish & Render', icon: Play },
            ].map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.num;
              const isPast = currentStep > step.num;
              return (
                <button
                  key={step.num}
                  onClick={() => setCurrentStep(step.num)}
                  className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap btn-pressable ${
                    isActive
                      ? 'bg-[#E3F2FD] border-2 border-[#2196F3] shadow-xs'
                      : isPast
                      ? 'bg-emerald-50/80 text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
                      : 'text-slate-500 hover:text-[#0D47A1] hover:bg-[#F0F7FF] border border-transparent'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                      isActive
                        ? 'bg-[#2196F3] text-white shadow-xs ring-2 ring-[#2196F3]/30'
                        : isPast
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="w-4 h-4" /> : step.num}
                  </div>
                  <div className="text-left min-w-0">
                    <p className={`text-xs font-bold truncate ${isActive ? 'text-[#0D47A1]' : isPast ? 'text-emerald-900' : 'text-slate-700'}`}>
                      {step.title}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium truncate">{step.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Step Contents */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
            {/* Step Left / Control Column */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Step 1: Media */}
              {currentStep === 1 && (
                <UploadZone
                  onUploadComplete={(data) => {
                    setUploadedVideo(data);
                  }}
                  onProceed={() => setCurrentStep(2)}
                  onReset={() => setUploadedVideo(null)}
                />
              )}

              {/* Step 2: Framing & Aspect Ratio */}
              {currentStep === 2 && (
                <div className="bg-white rounded-2xl p-6 border border-[#90CAF9]/60 shadow-xs flex flex-col gap-6">
                  <div>
                    <h3 className="text-base font-bold text-[#0D47A1] mb-1">Target Aspect Ratio &amp; Canvas</h3>
                    <p className="text-xs text-slate-600">
                      Select your target format. Videos are automatically reframed to fit vertical, square, or widescreen feeds.
                    </p>
                  </div>

                  {/* Preset Ratios with Visual Silicon Previews */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {
                        id: '9:16',
                        label: '9:16 Vertical',
                        badge: 'Recommended',
                        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                        desc: 'Reels, Shorts, TikTok',
                        res: '1080x1920',
                        shapeClass: 'w-4 h-7 rounded-[2px]',
                      },
                      {
                        id: '1:1',
                        label: '1:1 Square',
                        desc: 'Instagram & Threads Feed',
                        res: '1080x1080',
                        shapeClass: 'w-5 h-5 rounded-[2px]',
                      },
                      {
                        id: '4:5',
                        label: '4:5 Portrait',
                        desc: 'Social Mobile Feed',
                        res: '1080x1350',
                        shapeClass: 'w-5 h-6 rounded-[2px]',
                      },
                      {
                        id: '16:9',
                        label: '16:9 Landscape',
                        desc: 'YouTube & Desktop',
                        res: '1920x1080',
                        shapeClass: 'w-7 h-4 rounded-[2px]',
                      },
                    ].map((ratio) => {
                      const isSelected = selectedRatio === ratio.id;
                      return (
                        <button
                          key={ratio.id}
                          onClick={() => setSelectedRatio(ratio.id as any)}
                          className={`p-4 rounded-xl border text-left transition-all btn-pressable flex flex-col justify-between ${
                            isSelected
                              ? 'bg-[#E3F2FD] border-2 border-[#2196F3] text-[#0D47A1] shadow-sm ring-2 ring-[#2196F3]/20'
                              : 'bg-white border-[#90CAF9]/60 text-slate-700 hover:border-[#2196F3] hover:bg-[#F0F7FF]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div
                                className={`border-2 ${
                                  isSelected ? 'border-[#2196F3] bg-[#2196F3]/20' : 'border-slate-400 bg-slate-100'
                                } ${ratio.shapeClass}`}
                              />
                              {ratio.badge && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${ratio.badgeColor}`}>
                                  {ratio.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-bold text-[#0D47A1] mb-0.5">{ratio.label}</p>
                            <p className="text-[10px] text-[#2196F3] font-mono font-bold mb-1.5">{ratio.res}</p>
                            <p className="text-[10px] text-slate-500 font-medium leading-tight">{ratio.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Reframe Background Styling */}
                  <div className="pt-4 border-t border-[#90CAF9]/40">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-xs font-bold text-[#0D47A1]">
                          Background Styling (For aspect ratio padding)
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Choose how borders are filled when source video shape doesn&apos;t match target format.
                        </p>
                      </div>
                      {doesSourceMatchTarget() && (
                        <span className="text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-300 font-semibold shrink-0">
                          Source matches target format
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        {
                          id: 'blur',
                          title: 'Blurred Background (Recommended)',
                          desc: 'Full video centered over a stylized, softly blurred ambient copy of your video.',
                        },
                        {
                          id: 'solid',
                          title: 'Solid Black Bars (Letterbox)',
                          desc: 'Full video centered with clean solid black padding bars.',
                        },
                        {
                          id: 'crop',
                          title: 'Zoom to Fill (Smart Crop)',
                          desc: 'Fills viewport completely. Sides or top are cropped with speaker tracking.',
                        },
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          disabled={doesSourceMatchTarget()}
                          onClick={() => setReframeMode(mode.id as any)}
                          className={`p-4 rounded-xl border text-left transition-all btn-pressable ${
                            doesSourceMatchTarget()
                              ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                              : reframeMode === mode.id
                              ? 'bg-[#E3F2FD] border-2 border-[#2196F3] text-[#0D47A1] shadow-sm ring-2 ring-[#2196F3]/20'
                              : 'bg-white border-[#90CAF9]/60 text-slate-700 hover:border-[#2196F3] hover:bg-[#F0F7FF]'
                          }`}
                        >
                          <p className="text-xs font-bold text-[#0D47A1] mb-1">{mode.title}</p>
                          <p className="text-[11px] text-slate-600 leading-relaxed font-medium">{mode.desc}</p>
                        </button>
                      ))}
                    </div>

                    {/* Smart Pan & Scan (Only when Crop mode is active) */}
                    {reframeMode === 'crop' && (
                      <div className="mt-4 p-4 rounded-xl bg-[#F0F7FF] border border-[#90CAF9]/80 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Scan className="w-4 h-4 text-[#2196F3]" />
                            <h5 className="text-xs font-bold text-[#0D47A1]">Subject Alignment &amp; Speaker Tracking</h5>
                          </div>
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                            Smart Focus
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Choose how the vertical viewport centers on your widescreen video footage.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                          {[
                            {
                              id: 'auto_face',
                              title: 'Auto Face Tracking',
                              desc: 'Intelligently follows speakers while keeping motion smooth and steady.',
                              icon: Scan,
                              recommended: true,
                            },
                            {
                              id: 'center',
                              title: 'Center Focus',
                              desc: 'Locks viewport to the dead center of the frame.',
                              icon: AlignCenter,
                            },
                            {
                              id: 'left',
                              title: 'Left Edge',
                              desc: 'Anchors viewport to left margin.',
                              icon: AlignLeft,
                            },
                            {
                              id: 'right',
                              title: 'Right Edge',
                              desc: 'Anchors viewport to right margin.',
                              icon: AlignRight,
                            },
                          ].map((item) => {
                            const ItemIcon = item.icon;
                            const isSelected = focalPoint === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setFocalPoint(item.id as any)}
                                className={`p-3 rounded-lg border text-left transition-all btn-pressable flex flex-col justify-between ${
                                  isSelected
                                    ? 'bg-white border-2 border-[#2196F3] text-[#0D47A1] shadow-xs ring-1 ring-[#2196F3]/30'
                                    : 'bg-white/70 border-[#90CAF9]/50 text-slate-700 hover:border-[#2196F3] hover:bg-white'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <ItemIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#2196F3]' : 'text-slate-500'}`} />
                                      <span className="text-xs font-bold text-[#0D47A1]">{item.title}</span>
                                    </div>
                                    {item.recommended && (
                                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-200">
                                        Best
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-600 leading-snug">{item.desc}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Split Settings & Live Parts Table Preview */}
              {currentStep === 3 && (
                <div className="bg-white rounded-2xl p-6 border border-[#90CAF9]/60 shadow-xs flex flex-col gap-6">
                  <div>
                    <h3 className="text-base font-bold text-[#0D47A1] mb-1">Clip Duration &amp; Splitting Plan</h3>
                    <p className="text-xs text-slate-600">
                      Choose how your video is sliced into standalone clips with zero frame drift and clean cuts.
                    </p>
                  </div>

                  {/* Split Mode Selector */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: 'fixed', title: 'Fixed Duration', desc: 'e.g. Every 60 seconds' },
                      { id: 'parts', title: 'Equal Parts', desc: 'e.g. Exactly 5 parts' },
                      { id: 'custom', title: 'Custom Timestamps', desc: 'Manual start & end table' },
                      { id: 'ai_highlights', title: 'AI Highlights', desc: 'Viral sentence-cut hooks' },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setSplitMode(mode.id as any)}
                        className={`p-3.5 rounded-xl border text-left transition-all btn-pressable ${
                          splitMode === mode.id
                            ? 'bg-[#E3F2FD] border-2 border-[#2196F3] text-[#0D47A1] shadow-xs ring-2 ring-[#2196F3]/20'
                            : 'bg-white border-[#90CAF9]/60 text-slate-700 hover:border-[#2196F3] hover:bg-[#F0F7FF]'
                        }`}
                      >
                        <p className="text-xs font-bold text-[#0D47A1] mb-0.5">{mode.title}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{mode.desc}</p>
                      </button>
                    ))}
                  </div>

                  {/* Fixed Duration: Quick Chips & Custom Input */}
                  {splitMode === 'fixed' && (
                    <div className="bg-[#F0F7FF] p-4 rounded-xl border border-[#90CAF9]/60 flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <label className="text-xs font-bold text-[#0D47A1] block">Choose Clip Length</label>
                          <p className="text-[10px] text-slate-500">Pick a popular preset or type exact seconds</p>
                        </div>
                        {/* Quick Duration Chips */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[
                            { label: '30s (Shorts)', sec: 30 },
                            { label: '60s (Reels/TikTok)', sec: 60 },
                            { label: '90s (Stories)', sec: 90 },
                          ].map((chip) => (
                            <button
                              key={chip.sec}
                              type="button"
                              onClick={() => setFixedLength(chip.sec)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all btn-pressable ${
                                fixedLength === chip.sec
                                  ? 'bg-[#2196F3] text-white shadow-xs'
                                  : 'bg-white text-slate-700 border border-[#90CAF9]/60 hover:border-[#2196F3]'
                              }`}
                            >
                              {chip.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#90CAF9]/40">
                        <span className="text-xs font-semibold text-slate-600">Exact Duration:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={fixedLength}
                            onChange={(e) => setFixedLength(Math.max(1, Number(e.target.value)))}
                            className="w-24 bg-white border border-[#90CAF9] rounded-lg px-3 py-1.5 text-xs text-[#0D47A1] font-bold text-center font-mono focus:outline-none focus:border-[#2196F3] focus:ring-2 focus:ring-[#2196F3]/20"
                          />
                          <span className="text-xs font-semibold text-slate-600">seconds per clip</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Equal Parts Mode */}
                  {splitMode === 'parts' && (
                    <div className="bg-[#F0F7FF] p-4 rounded-xl border border-[#90CAF9]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <label className="text-xs font-bold text-[#0D47A1] block mb-0.5">Total Number of Parts</label>
                        <p className="text-[11px] text-slate-600">Video will be evenly divided into this number of segments</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={numberOfParts}
                          onChange={(e) => setNumberOfParts(Math.max(1, Number(e.target.value)))}
                          className="w-24 bg-white border border-[#90CAF9] rounded-lg px-3 py-1.5 text-xs text-[#0D47A1] font-bold text-center font-mono focus:outline-none focus:border-[#2196F3] focus:ring-2 focus:ring-[#2196F3]/20"
                        />
                        <span className="text-xs font-semibold text-slate-600">parts</span>
                      </div>
                    </div>
                  )}

                  {/* AI Highlights Mode */}
                  {splitMode === 'ai_highlights' && (
                    <div className="bg-[#F0F7FF] p-5 rounded-2xl border border-[#90CAF9]/80 flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#90CAF9]/40 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#0D47A1]">AI Viral Highlight Discovery</span>
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
                              Ollama / Gemini
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            Extracts speech, identifies high-retention hooks, and sets sentence boundaries with zero mid-word cuts.
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={isDetectingHighlights || !uploadedVideo?.sanitizedFilename}
                          onClick={handleDetectAIHighlights}
                          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 btn-pressable"
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${isDetectingHighlights ? 'animate-spin' : ''}`} />
                          <span>{isDetectingHighlights ? 'Analyzing Speech...' : 'Detect Viral Moments'}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-[#90CAF9]/60">
                          <div>
                            <label className="text-xs font-bold text-[#0D47A1] block">Target Clip Length</label>
                            <p className="text-[10px] text-slate-500">Ideal duration for Shorts/Reels</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="20"
                              max="90"
                              value={aiTargetDuration}
                              onChange={(e) => setAiTargetDuration(Math.max(20, Number(e.target.value)))}
                              className="w-16 bg-[#F8FAFC] border border-[#90CAF9] rounded-lg px-2 py-1 text-xs text-[#0D47A1] font-bold text-center font-mono focus:outline-none focus:border-[#2196F3]"
                            />
                            <span className="text-[11px] font-semibold text-slate-600">s</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-[#90CAF9]/60">
                          <div>
                            <label className="text-xs font-bold text-[#0D47A1] block">Maximum Clips</label>
                            <p className="text-[10px] text-slate-500">Top ranked viral moments</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              max="15"
                              value={aiMaxClips}
                              onChange={(e) => setAiMaxClips(Math.max(1, Number(e.target.value)))}
                              className="w-16 bg-[#F8FAFC] border border-[#90CAF9] rounded-lg px-2 py-1 text-xs text-[#0D47A1] font-bold text-center font-mono focus:outline-none focus:border-[#2196F3]"
                            />
                            <span className="text-[11px] font-semibold text-slate-600">clips</span>
                          </div>
                        </div>
                      </div>

                      {/* Detected Clips List */}
                      {aiClips.length > 0 ? (
                        <div className="space-y-2 pt-1">
                          <div className="text-[11px] font-bold text-[#0D47A1] uppercase tracking-wider">
                            Identified Viral Highlights ({aiClips.length})
                          </div>
                          <div className="space-y-2">
                            {aiClips.map((clip, idx) => (
                              <div
                                key={clip.id}
                                className="bg-white p-3.5 rounded-xl border border-[#90CAF9]/60 shadow-xs flex items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-[#0D47A1] font-bold text-xs flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-xs font-bold text-slate-900 truncate">{clip.hookHeadline}</p>
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
                                        Score: {clip.viralScore}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                                      {clip.start.toFixed(1)}s to {clip.end.toFixed(1)}s ({(clip.end - clip.start).toFixed(1)}s) {clip.reasoning ? `• ${clip.reasoning}` : ''}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeAiClip(clip.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
                                  title="Remove clip"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 px-3 bg-white/60 rounded-xl border border-dashed border-[#90CAF9]">
                          <p className="text-xs text-slate-600 font-medium">
                            No viral clips detected yet. Click &quot;Detect Viral Moments&quot; to scan speech and identify peak moments.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Summary Feedback Banner */}
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {computedPlan.length} clips calculated with zero frame drift
                      {splitMode === 'fixed' ? ` (~${fixedLength}s each)` : ''}.
                    </span>
                  </div>

                  {/* Collapsible Fine-Tuning & Overlap Accordion */}
                  <div className="rounded-xl border border-[#90CAF9]/60 bg-[#F8FAFC] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowSplitAdvanced(!showSplitAdvanced)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left text-xs font-bold text-[#0D47A1] hover:bg-[#F0F7FF] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Sliders className="w-3.5 h-3.5 text-[#2196F3]" />
                        <span>Fine-Tune Clip Overlap &amp; Last Part Rules</span>
                        <span className="text-[10px] font-normal text-slate-500">
                          (Overlap: {overlapSeconds}s &bull; Min last part: {minLastPartSeconds}s &bull; {lastPartAction === 'merge' ? 'Merge' : 'Keep'})
                        </span>
                      </div>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                          showSplitAdvanced ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {showSplitAdvanced && (
                      <div className="p-4 pt-3 border-t border-[#90CAF9]/40 bg-white grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-[#F0F7FF] p-3.5 rounded-xl border border-[#90CAF9]/60 flex items-center justify-between">
                          <div>
                            <label className="text-xs font-bold text-[#0D47A1] block">Overlap Between Parts</label>
                            <p className="text-[10px] text-slate-600">Replays N seconds at the start of next part</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max="30"
                              value={overlapSeconds}
                              onChange={(e) => setOverlapSeconds(Math.max(0, Number(e.target.value)))}
                              className="w-16 bg-white border border-[#90CAF9] rounded-lg px-2 py-1 text-xs text-[#0D47A1] font-bold text-center font-mono focus:outline-none focus:border-[#2196F3]"
                            />
                            <span className="text-[11px] font-semibold text-slate-600">s</span>
                          </div>
                        </div>

                        <div className="bg-[#F0F7FF] p-3.5 rounded-xl border border-[#90CAF9]/60 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-xs font-bold text-[#0D47A1] block">Minimum Last-Part Length</label>
                              <p className="text-[10px] text-slate-600">If final part is shorter than this</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="1"
                                value={minLastPartSeconds}
                                onChange={(e) => setMinLastPartSeconds(Math.max(1, Number(e.target.value)))}
                                className="w-16 bg-white border border-[#90CAF9] rounded-lg px-2 py-1 text-xs text-[#0D47A1] font-bold text-center font-mono focus:outline-none focus:border-[#2196F3]"
                              />
                              <span className="text-[11px] font-semibold text-slate-600">s</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs pt-1">
                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                              <input
                                type="radio"
                                name="lastPartAction"
                                checked={lastPartAction === 'merge'}
                                onChange={() => setLastPartAction('merge')}
                                className="text-[#2196F3] focus:ring-0"
                              />
                              Merge into previous
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                              <input
                                type="radio"
                                name="lastPartAction"
                                checked={lastPartAction === 'keep'}
                                onChange={() => setLastPartAction('keep')}
                                className="text-[#2196F3] focus:ring-0"
                              />
                              Keep as short part
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {planError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2 font-medium">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{planError}</span>
                    </div>
                  )}

                  <PartsTable
                    plan={computedPlan}
                    warnings={planWarnings}
                    adjustments={planAdjustments}
                    isCustomMode={splitMode === 'custom'}
                    customRows={customTimestamps}
                    onAddCustomRow={addCustomRow}
                    onRemoveCustomRow={removeCustomRow}
                    onUpdateCustomRow={updateCustomRow}
                  />
                </div>
              )}

              {/* Step 4: Text Overlays */}
              {currentStep === 4 && (
                <TextOverlayEditor
                  settings={textOverlaySettings}
                  onChange={setTextOverlaySettings}
                  partCount={computedPlan.length || 5}
                  originalFilename={uploadedVideo?.originalFilename}
                  sanitizedFilename={uploadedVideo?.sanitizedFilename}
                  uploadedVideoId={uploadedVideo?.uploadId}
                />
              )}

              {/* Step 5: Export & Render */}
              {currentStep === 5 && (
                <div className="bg-white rounded-2xl p-6 border border-[#90CAF9]/60 shadow-sm flex flex-col gap-6">
                  <div className="flex items-center justify-between pb-3 border-b border-[#90CAF9]/40">
                    <div>
                      <h3 className="text-base font-bold text-[#0D47A1]">Step 5: Export &amp; Render</h3>
                      <p className="text-xs text-slate-600">
                        Choose where to save your clips, adjust quality, and start rendering in one click.
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {computedPlan.length} clips planned
                    </span>
                  </div>

                  {/* Destination Target */}
                  <div className="flex flex-col gap-3">
                    <label className="text-xs font-bold text-[#0D47A1] uppercase tracking-wide">
                      1. Where to Save Your Clips
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Option 1: Local ZIP */}
                      <button
                        type="button"
                        onClick={() => setDestination('local')}
                        className={`p-4 rounded-xl border text-left transition-all btn-pressable ${
                          destination === 'local'
                            ? 'bg-[#E3F2FD] border-2 border-[#2196F3] text-[#0D47A1] shadow-md ring-2 ring-[#2196F3]/20'
                            : 'bg-white border-[#90CAF9]/60 text-slate-700 hover:border-[#2196F3] hover:bg-[#F0F7FF]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Download className="w-4 h-4 text-[#2196F3]" />
                            <span className="text-xs font-bold text-[#0D47A1]">Download to Mac / PC (ZIP)</span>
                          </div>
                          {destination === 'local' && <Check className="w-4 h-4 text-[#2196F3]" />}
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                          Keeps all rendered clips on local storage. Download as a single ZIP or individual MP4s straight from your browser.
                        </p>
                      </button>

                      {/* Option 2: Google Drive */}
                      <button
                        type="button"
                        onClick={() => setDestination('drive')}
                        className={`p-4 rounded-xl border text-left transition-all btn-pressable ${
                          destination === 'drive'
                            ? 'bg-[#E3F2FD] border-2 border-[#2196F3] text-[#0D47A1] shadow-md ring-2 ring-[#2196F3]/20'
                            : 'bg-white border-[#90CAF9]/60 text-slate-700 hover:border-[#2196F3] hover:bg-[#F0F7FF]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FolderSync className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-bold text-[#0D47A1]">Direct to Google Drive</span>
                          </div>
                          {destination === 'drive' && <Check className="w-4 h-4 text-[#2196F3]" />}
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed mb-2 font-medium">
                          Uploads directly to your Google Drive and purges local temp files immediately to save storage.
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          {health?.services.googleDrive.configured ? (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Drive Connected
                            </span>
                          ) : (
                            <span className="text-amber-700 font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600" /> Drive not connected (uses local fallback)
                            </span>
                          )}
                        </div>
                      </button>
                    </div>

                    {/* Sub-options when Google Drive is chosen */}
                    {destination === 'drive' && (
                      <div className="bg-[#F0F7FF] p-4 rounded-xl border border-[#90CAF9]/60 flex flex-col gap-3">
                        <div>
                          <label className="text-xs font-bold text-[#0D47A1] block mb-1">
                            Google Drive Folder ID or URL (Optional)
                          </label>
                          <input
                            type="text"
                            value={driveFolderId}
                            onChange={(e) => setDriveFolderId(e.target.value)}
                            placeholder="Leave empty for root folder or default configured folder"
                            className="w-full bg-white border border-[#90CAF9] rounded-lg px-3 py-1.5 text-xs text-[#0D47A1] font-mono focus:outline-none focus:border-[#2196F3]"
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                          <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              checked={createSubfolder}
                              onChange={(e) => setCreateSubfolder(e.target.checked)}
                              className="rounded text-[#2196F3] focus:ring-0"
                            />
                            Create a subfolder named after the source video
                          </label>

                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-600 font-medium shrink-0">If file exists:</span>
                            <div className="w-44">
                              <CustomSelect
                                value={onConflict}
                                onChange={(val) => setOnConflict(val as any)}
                                size="sm"
                                options={[
                                  { value: 'rename', label: 'Auto-rename' },
                                  { value: 'overwrite', label: 'Overwrite' },
                                  { value: 'skip', label: 'Skip upload' },
                                ]}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Project Folder & Filename Pattern */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#90CAF9]/40">
                    {/* Folder Organization */}
                    <div className="bg-[#F0F7FF] p-4 rounded-xl border border-[#90CAF9]/60 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Folder className="w-4 h-4 text-[#2196F3]" />
                        <label className="text-xs font-bold text-[#0D47A1]">Project Folder</label>
                      </div>
                      <p className="text-[10px] text-slate-600">Assign output clips to a folder for easy sorting</p>
                      <FolderSelector
                        selectedFolder={selectedFolder}
                        onSelectFolder={setSelectedFolder}
                      />
                    </div>

                    {/* Filename Template */}
                    <div className="bg-[#F0F7FF] p-4 rounded-xl border border-[#90CAF9]/60 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-[#0D47A1]">Filename Pattern</label>
                        <span className="text-[10px] font-mono font-semibold text-emerald-700 truncate max-w-[170px]">
                          {getSampleFilename()}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={filenameTemplate}
                          onChange={(e) => setFilenameTemplate(e.target.value)}
                          className="flex-1 bg-white border border-[#90CAF9] rounded-lg px-2.5 py-1.5 text-xs text-[#0D47A1] font-mono font-semibold focus:outline-none focus:border-[#2196F3]"
                        />
                        <span className="px-2.5 py-1.5 rounded-lg bg-white border border-[#90CAF9] text-xs text-slate-600 font-mono font-bold">
                          .mp4
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] pt-0.5">
                        <span className="text-slate-500 font-medium">Add tag:</span>
                        {['{title}', '{part}', '{nn}', '{total}'].map((token) => (
                          <button
                            type="button"
                            key={token}
                            onClick={() => setFilenameTemplate((prev) => `${prev}_${token}`)}
                            className="px-1.5 py-0.5 rounded bg-white hover:bg-[#E3F2FD] text-[#0D47A1] font-mono font-bold border border-[#90CAF9]"
                          >
                            +{token}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Quality Selector */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-[#90CAF9]/40">
                    <label className="text-xs font-bold text-[#0D47A1] uppercase tracking-wide">
                      2. Encoding Quality
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        {
                          id: 'fast',
                          title: 'Fast Draft',
                          desc: 'Quick rendering for rapid previews.',
                          badge: 'Fastest',
                        },
                        {
                          id: 'balanced',
                          title: 'Balanced (Standard)',
                          desc: 'Best balance of quality and speed.',
                          badge: 'Recommended',
                        },
                        {
                          id: 'high',
                          title: 'High Quality',
                          desc: 'Crisp output for final social uploads.',
                          badge: 'Pristine',
                        },
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setQualityPreset(preset.id as any)}
                          className={`p-3 rounded-xl border text-left transition-all btn-pressable ${
                            qualityPreset === preset.id
                              ? 'bg-[#E3F2FD] border-2 border-[#2196F3] text-[#0D47A1] shadow-sm'
                              : 'bg-white border-[#90CAF9]/60 text-slate-700 hover:border-[#2196F3] hover:bg-[#F0F7FF]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-[#0D47A1]">{preset.title}</span>
                            <span className="text-[9px] font-semibold text-[#0D47A1] bg-[#E3F2FD] border border-[#90CAF9] px-1.5 py-0.2 rounded">
                              {preset.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-600 font-medium">{preset.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary & Start Button */}
                  <div className="bg-[#F0F7FF] p-4 rounded-xl border border-[#90CAF9]/60 flex flex-col gap-3 mt-1">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Total Clips</span>
                        <span className="font-bold text-[#0D47A1]">{computedPlan.length} parts</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Aspect Ratio</span>
                        <span className="font-bold text-[#0D47A1]">{selectedRatio}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Destination</span>
                        <span className="font-bold text-[#0D47A1] capitalize">{destination === 'drive' ? 'Google Drive' : 'Local ZIP'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Estimated Size</span>
                        <span className="font-bold text-[#0D47A1]">~{((uploadedVideo?.sizeBytes || 100 * 1024 * 1024) / (1024 * 1024)).toFixed(0)} MB</span>
                      </div>
                    </div>

                    {submitError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2 font-medium">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>{submitError}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={isSubmittingJob || computedPlan.length === 0}
                      onClick={handleStartProcessing}
                      className="btn-pressable w-full py-3.5 rounded-xl bg-[#2196F3] hover:bg-[#1E88E5] text-white font-bold text-sm shadow-md shadow-[#2196F3]/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isSubmittingJob ? (
                        <>
                          <RotateCw className="w-4 h-4 animate-spin" />
                          <span>Dispatching Clips to Processing Engine...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-white" />
                          <span>Start Processing {computedPlan.length} Video Parts</span>
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-slate-500 text-center font-medium">
                      Processing runs in the background. You will be redirected to the Queue view to monitor live progress.
                    </p>
                  </div>
                </div>
              )}

              {/* Wizard navigation footer */}
              {currentStep < 5 ? (
                <div className="flex items-center justify-between pt-3 border-t border-[#90CAF9]/40 mt-3">
                  <button
                    type="button"
                    disabled={currentStep === 1}
                    onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-[#0D47A1] bg-white border border-[#90CAF9]/60 hover:bg-[#F0F7FF] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Previous Step
                  </button>
                  <button
                    type="button"
                    disabled={currentStep === 1 && !uploadedVideo}
                    onClick={() => setCurrentStep((s) => Math.min(5, s + 1))}
                    className="btn-pressable flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2196F3] hover:bg-[#1E88E5] text-white font-semibold text-xs shadow-md shadow-[#2196F3]/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <span>
                      {currentStep === 1 && 'Continue to Framing'}
                      {currentStep === 2 && 'Continue to Clips'}
                      {currentStep === 3 && 'Continue to Style'}
                      {currentStep === 4 && 'Continue to Export'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-3 border-t border-[#90CAF9]/40 mt-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-[#0D47A1] bg-white border border-[#90CAF9]/60 hover:bg-[#F0F7FF] transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Style
                  </button>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Ready to render {computedPlan.length} clips
                  </span>
                </div>
              )}
            </div>

            {/* Right Column: Live Frame Preview Canvas & Inspector */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <PreviewCanvas
                sourceFilename={uploadedVideo?.sanitizedFilename}
                aspectRatio={selectedRatio}
                reframeMode={reframeMode}
                focalPoint={focalPoint}
                probe={uploadedVideo?.probe}
                textOverlay={textOverlaySettings}
                showSafeZone={showSafeZone}
                onToggleSafeZone={() => setShowSafeZone(!showSafeZone)}
                totalParts={computedPlan.length || 5}
              />

              <div className="bg-white rounded-2xl p-4 border border-[#90CAF9]/60 shadow-sm text-xs text-slate-600 space-y-2">
                <div className="flex justify-between pb-1 border-b border-[#90CAF9]/30">
                  <span className="font-semibold text-slate-500">Source Video:</span>
                  <span className="text-[#0D47A1] font-bold truncate max-w-[160px]">
                    {uploadedVideo ? uploadedVideo.originalFilename : 'Awaiting upload'}
                  </span>
                </div>
                <div className="flex justify-between pb-1 border-b border-[#90CAF9]/30">
                  <span className="font-semibold text-slate-500">Parts Calculated:</span>
                  <span className="text-emerald-700 font-bold font-mono">
                    {computedPlan.length} parts
                  </span>
                </div>
                <div className="flex justify-between pb-1 border-b border-[#90CAF9]/30">
                  <span className="font-semibold text-slate-500">Split Mode:</span>
                  <span className="text-slate-800 font-semibold capitalize">{splitMode}</span>
                </div>
                <div className="flex justify-between pb-1 border-b border-[#90CAF9]/30">
                  <span className="font-semibold text-slate-500">Destination:</span>
                  <span className="text-slate-800 font-semibold capitalize">{destination}</span>
                </div>
                <div className="flex justify-between pb-1 border-b border-[#90CAF9]/30">
                  <span className="font-semibold text-slate-500">Top Text:</span>
                  <span className="text-slate-800 font-semibold">
                    {textOverlaySettings.top.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Bottom Text:</span>
                  <span className="text-slate-800 font-semibold">
                    {textOverlaySettings.bottom.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Screen 2: Job Queue & Active Monitoring */}
      {activeTab === 'queue' && (
        <div className="flex-1 flex flex-col gap-6">
          {activeJobId ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-[#90CAF9]/60 shadow-sm">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#2196F3]" />
                  <h3 className="text-xs font-bold text-[#0D47A1]">
                    Active Render Job: <span className="font-mono text-[#2196F3]">{activeJobId}</span>
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('history')}
                    className="px-3 py-1.5 rounded-lg bg-[#E3F2FD] hover:bg-[#90CAF9]/40 text-[#0D47A1] text-xs font-semibold border border-[#90CAF9] transition-all"
                  >
                    Past Jobs
                  </button>
                  <button
                    onClick={() => {
                      setActiveJobId(null);
                      fetchActiveJobs();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#E3F2FD] hover:bg-[#90CAF9]/40 text-[#0D47A1] text-xs font-semibold border border-[#90CAF9] transition-all"
                  >
                    Switch Job
                  </button>
                </div>
              </div>

              <JobProgressView
                jobId={activeJobId}
                onJobFinished={() => {
                  fetchHealth();
                  fetchActiveJobs();
                }}
              />
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center flex flex-col items-center justify-center flex-1 border border-[#90CAF9]/60 shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-[#E3F2FD] flex items-center justify-center text-[#2196F3] mb-4 shadow-sm border border-[#90CAF9]">
                <Layers className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-[#0D47A1] mb-1">BullMQ Worker Queue</h3>
              <p className="text-xs text-slate-600 max-w-md mb-6 font-medium">
                No active job is currently selected. Select an existing job from the list below or start a new job from the wizard.
              </p>

              {activeJobsList.length > 0 ? (
                <div className="w-full max-w-lg flex flex-col gap-2">
                  <p className="text-xs font-bold text-[#0D47A1] text-left mb-1">Active / Recent Jobs:</p>
                  {activeJobsList.map((job) => (
                    <button
                      key={String((job as any)._id)}
                      onClick={() => setActiveJobId(String((job as any)._id))}
                      className="p-3.5 rounded-xl bg-[#F0F7FF] hover:bg-[#E3F2FD] border border-[#90CAF9]/60 flex items-center justify-between text-xs text-left transition-all btn-pressable"
                    >
                      <div>
                        <p className="font-bold text-[#0D47A1]">{job.source?.originalName}</p>
                        <p className="text-[10px] text-slate-500 font-mono font-medium">
                          Status: {job.status} &bull; {job.counts?.rendered || 0}/{job.counts?.total || 0} parts
                        </p>
                      </div>
                      <span className="text-[#2196F3] font-bold flex items-center gap-1">
                        Monitor <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setActiveTab('new-job')}
                  className="btn-pressable px-6 py-2.5 rounded-xl bg-[#2196F3] hover:bg-[#1E88E5] text-white text-xs font-bold shadow-md shadow-[#2196F3]/30 flex items-center gap-2"
                >
                  <Play className="w-3.5 h-3.5" />
                  Create New Job
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Screen 3: History */}
      {activeTab === 'history' && (
        <JobHistoryView
          onSelectJob={(jobId) => {
            setActiveJobId(jobId);
            setActiveTab('queue');
          }}
          onDuplicateJob={handleDuplicateJob}
        />
      )}

      {/* Screen 4: Settings & Logs */}
      {activeTab === 'settings' && <SettingsLogsView />}

      {/* Screen 4.5: Waterfall Syndication & Auto-Reschedule Loop */}
      {activeTab === 'waterfall' && <WaterfallSyndicationView />}

      {/* Screen 5: YouTube Publisher */}
      {activeTab === 'youtube' && <YouTubePublisherView />}

      {/* Screen 6: Uploaded Videos & Views Tracker */}
      {activeTab === 'uploaded-videos' && <YouTubeUploadedVideosView />}

      {/* Screen 7: Threads Composer & Scheduler */}
      {activeTab === 'threads-composer' && <ThreadsPublisherView initialSubTab="composer" />}

      {/* Screen 8: Threads Scheduled & Queue */}
      {activeTab === 'threads-posts' && <ThreadsPublisherView initialSubTab="posts" />}

      {/* Screen 9: Threads Analytics & Insights (Replacing Blacktwist) */}
      {activeTab === 'threads-analytics' && <ThreadsPublisherView initialSubTab="analytics" />}

      {/* Screen 9.5: Threads MCP Server & Antigravity Bridge */}
      {activeTab === 'threads-mcp' && <ThreadsPublisherView initialSubTab="mcp" />}

      {/* Screen 10: Instagram Reels Composer & Scheduler */}
      {activeTab === 'instagram-composer' && <InstagramPublisherView initialSubTab="composer" />}

      {/* Screen 11: Instagram Scheduled & Queue */}
      {activeTab === 'instagram-posts' && <InstagramPublisherView initialSubTab="posts" />}

      {/* Screen 12: Instagram Reels Analytics & Insights */}
      {activeTab === 'instagram-analytics' && <InstagramPublisherView initialSubTab="analytics" />}
      </div>

      <NoticeModal
        isOpen={notice.isOpen}
        onClose={() => setNotice((prev) => ({ ...prev, isOpen: false }))}
        title={notice.title}
        message={notice.message}
        type={notice.type}
      />
    </div>
  );
}
