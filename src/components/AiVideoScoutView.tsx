'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Search,
  Clock,
  Repeat,
  Copy,
  Play,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Folder,
  Film,
  RefreshCw,
  ChevronRight,
  Eye,
  Sliders,
  Calendar,
  Layers,
  ArrowUpRight,
  Video,
  ListOrdered,
  Check,
  X,
} from 'lucide-react';
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect';

const FOLDER_OPTIONS: SelectOption[] = [
  { value: 'General', label: 'General', description: 'Default storage repository' },
  { value: 'Shorts', label: 'Shorts', description: 'Short clips folder' },
  { value: 'GTA-5', label: 'GTA-5', description: 'GTA V gameplay & stunts folder' },
  { value: 'Movie-Vault', label: 'Movie-Vault', description: 'Film climaxes & viral scenes' },
  { value: 'local', label: 'Local Storage', description: 'Direct device internal storage' },
];

const COUNT_OPTIONS: SelectOption[] = [
  { value: '3', label: '3 Clips' },
  { value: '5', label: '5 Clips' },
  { value: '8', label: '8 Clips' },
  { value: '10', label: '10 Clips' },
];

const CAPTION_STYLE_OPTIONS: SelectOption[] = [
  { value: 'viral_yellow', label: 'Viral Yellow (Hormozi)', description: 'Bold yellow with thick outline' },
  { value: 'classic_white', label: 'Classic White', description: 'High contrast clean white' },
  { value: 'karaoke_glow', label: 'Karaoke Glow', description: 'Gold glow dynamic highlights' },
];

const HOUR_OPTIONS: SelectOption[] = Array.from({ length: 24 }).map((_, h) => ({
  value: String(h),
  label: `${String(h).padStart(2, '0')}:00`,
}));

interface CandidateVideo {
  id: string;
  title: string;
  url: string;
  viewCount: number;
  durationSeconds: number;
  uploadDate: string;
  thumbnailUrl: string;
  aiReason?: string;
  querySource?: string;
}

interface VideoScoutSchedule {
  _id: string;
  name: string;
  prompt: string;
  targetFolder: string;
  dailyCount: number;
  scheduleType: 'daily' | 'interval' | 'manual';
  cronHour: number;
  cronMinute: number;
  intervalHours?: number;
  isActive: boolean;
  autoCaption: boolean;
  captionStyle: 'viral_yellow' | 'classic_white' | 'karaoke_glow';
  reframeMode: string;
  autoSplit: boolean;
  partDurationSeconds: number;
  seenVideoIds: string[];
  totalIngestedCount: number;
  lastRunAt?: string;
  nextRunAt?: string;
  lastRunResult?: {
    date: string;
    foundCount: number;
    queuedCount: number;
    videoTitles: string[];
    status: 'success' | 'partial' | 'failed' | 'empty';
    errorMessage?: string;
  };
}

const PRESETS = [
  {
    label: 'GTA-5 Stunts & Gameplay',
    folder: 'GTA-5',
    prompt: 'Top viral GTA 5 stunt and drift videos',
  },
  {
    label: 'Movie Vault Climaxes',
    folder: 'Movie-Vault',
    prompt: 'Mind-bending psychological thriller endings and climax movie scenes',
  },
  {
    label: 'Trending Comedy Scenes',
    folder: 'General',
    prompt: 'Trending Bollywood comedy movie scenes with high views',
  },
];

export function AiVideoScoutView() {
  const [activeSubTab, setActiveSubTab] = useState<'instant' | 'schedules'>('instant');

  // Instant Scout State
  const [prompt, setPrompt] = useState<string>('');
  const [targetFolder, setTargetFolder] = useState<string>('General');
  const [targetCount, setTargetCount] = useState<number>(5);
  const [captionStyle, setCaptionStyle] = useState<'viral_yellow' | 'classic_white' | 'karaoke_glow'>('viral_yellow');
  const [autoCaption, setAutoCaption] = useState<boolean>(false);
  const [autoIngest, setAutoIngest] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Instant Scout Results
  const [scoutResult, setScoutResult] = useState<{
    selectedVideos: CandidateVideo[];
    totalFound: number;
    uniqueCandidates: number;
    alreadySeenCount: number;
    queuedCount: number;
  } | null>(null);
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());
  const [isBatchQueuing, setIsBatchQueuing] = useState<boolean>(false);

  // Schedules State
  const [schedules, setSchedules] = useState<VideoScoutSchedule[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [scheduleActionId, setScheduleActionId] = useState<string | null>(null);

  // History Drawer State
  const [historySchedule, setHistorySchedule] = useState<VideoScoutSchedule | null>(null);

  // New Schedule Form
  const [newScheduleName, setNewScheduleName] = useState<string>('Daily GTA 5 Scout');
  const [newSchedulePrompt, setNewSchedulePrompt] = useState<string>('Find 5 most viral GTA 5 stunt videos every day, add yellow subtitles, and save to GTA-5');
  const [newScheduleFolder, setNewScheduleFolder] = useState<string>('GTA-5');
  const [newScheduleCount, setNewScheduleCount] = useState<number>(5);
  const [newScheduleHour, setNewScheduleHour] = useState<number>(9);
  const [newScheduleMinute, setNewScheduleMinute] = useState<number>(0);
  const [newScheduleCaptionStyle, setNewScheduleCaptionStyle] = useState<'viral_yellow' | 'classic_white' | 'karaoke_glow'>('viral_yellow');

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 40)]);
  };

  const fetchSchedules = useCallback(async () => {
    setIsLoadingSchedules(true);
    try {
      const res = await fetch('/api/scout/schedules');
      const data = await res.json();
      if (data.success && Array.isArray(data.schedules)) {
        setSchedules(data.schedules);
      }
    } catch {
      // Ignore network errors on background poll
    } finally {
      setIsLoadingSchedules(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Execute Instant Scout
  const handleRunInstantScout = async () => {
    if (!prompt.trim()) return;
    setIsSearching(true);
    setScoutResult(null);
    setLogs([]);
    addLog(`Searching online videos for prompt: "${prompt}"`);
    addLog(`Target Folder: [${targetFolder}], Mode: ${autoIngest ? 'Direct Ingest' : 'Review & Approve'}`);

    try {
      const res = await fetch('/api/scout/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          folderOverride: targetFolder,
          autoIngest,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete discovery.');
      }

      const resData = data.result;
      setScoutResult({
        selectedVideos: resData.selectedVideos || [],
        totalFound: resData.totalFound || 0,
        uniqueCandidates: resData.uniqueCandidates || 0,
        alreadySeenCount: resData.alreadySeenCount || 0,
        queuedCount: resData.queuedCount || 0,
      });

      addLog(`Discovered ${resData.totalFound} candidate videos across YouTube.`);
      addLog(`Filtered duplicates: ${resData.alreadySeenCount} previously processed videos discarded.`);
      addLog(`AI selected top ${resData.selectedVideos?.length || 0} viral winners.`);

      if (autoIngest && resData.queuedCount > 0) {
        addLog(`Successfully queued ${resData.queuedCount} clips directly into download pipeline!`);
        const ids = new Set<string>(resData.selectedVideos.map((v: CandidateVideo) => v.id));
        setQueuedIds(ids);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Error during execution: ${msg}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Queue a single candidate from review cards
  const handleQueueSingleVideo = async (video: CandidateVideo) => {
    try {
      setQueuedIds((prev) => new Set([...prev, video.id]));
      addLog(`Queuing clip "${video.title}" to folder [${targetFolder}]...`);

      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: video.url,
          folderName: targetFolder,
          folderId: targetFolder,
          title: video.title,
          description: video.aiReason || `Auto-scouted for: ${prompt}`,
          autoCaption,
          captionStyle,
          sourceClient: 'ai_video_scout',
        }),
      });

      if (res.ok) {
        addLog(`Queued "${video.title}" successfully.`);
      } else {
        addLog(`Failed to queue "${video.title}".`);
      }
    } catch {
      addLog(`Network error queuing "${video.title}".`);
    }
  };

  // Queue all candidates at once
  const handleQueueAllCandidates = async () => {
    if (!scoutResult?.selectedVideos) return;
    setIsBatchQueuing(true);
    addLog(`Batch-queuing all ${scoutResult.selectedVideos.length} clips into download pipeline...`);

    for (const v of scoutResult.selectedVideos) {
      if (!queuedIds.has(v.id)) {
        await handleQueueSingleVideo(v);
      }
    }
    setIsBatchQueuing(false);
    addLog('All clips queued! Worker will now download, subtitle, and upload to Google Drive.');
  };

  // Create new schedule
  const handleCreateSchedule = async () => {
    if (!newSchedulePrompt.trim()) return;
    try {
      const res = await fetch('/api/scout/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newScheduleName,
          prompt: newSchedulePrompt,
          targetFolder: newScheduleFolder,
          dailyCount: newScheduleCount,
          cronHour: newScheduleHour,
          cronMinute: newScheduleMinute,
          captionStyle: newScheduleCaptionStyle,
          autoCaption: true,
        }),
      });

      if (res.ok) {
        setIsCreateModalOpen(false);
        fetchSchedules();
      }
    } catch {
      // Handled
    }
  };

  // Trigger immediate run of schedule
  const handleRunScheduleNow = async (id: string, name: string) => {
    setScheduleActionId(id);
    addLog(`Manually triggering scheduled task "${name}"...`);
    try {
      const res = await fetch(`/api/scout/schedules/${id}/run`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        addLog(`Task "${name}" finished: Queued ${data.result.queuedCount} fresh unique clips.`);
        fetchSchedules();
      } else {
        addLog(`Task "${name}" error: ${data.error}`);
      }
    } catch {
      addLog(`Failed to trigger task "${name}".`);
    } finally {
      setScheduleActionId(null);
    }
  };

  // Clone schedule
  const handleCloneSchedule = async (id: string, name: string) => {
    setScheduleActionId(id);
    addLog(`Cloning schedule "${name}"...`);
    try {
      const res = await fetch(`/api/scout/schedules/${id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${name} (Copy)` }),
      });
      if (res.ok) {
        addLog(`Schedule cloned successfully.`);
        fetchSchedules();
      }
    } catch {
      addLog(`Failed to clone schedule.`);
    } finally {
      setScheduleActionId(null);
    }
  };

  // Toggle active/pause
  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      await fetch(`/api/scout/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !current }),
      });
      fetchSchedules();
    } catch {}
  };

  // Delete schedule
  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    try {
      await fetch(`/api/scout/schedules/${id}`, { method: 'DELETE' });
      fetchSchedules();
    } catch {}
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-800/40 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Autonomous AI Pipeline
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Zero-Duplicate Engine
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-400" />
              Find Online Videos
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Search for online videos on any topic in plain English and save them directly into your Ingest Downloads folder.
            </p>
          </div>

          {/* SubTab Navigation */}
          <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 shadow-inner">
            <button
              onClick={() => setActiveSubTab('instant')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeSubTab === 'instant'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" />
              Instant Scout
            </button>
            <button
              onClick={() => setActiveSubTab('schedules')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeSubTab === 'schedules'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Repeat className="w-4 h-4" />
              Autopilot Loops
              {schedules.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-xs bg-indigo-950 text-indigo-300 font-bold">
                  {schedules.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: INSTANT SCOUT VIEW */}
      {activeSubTab === 'instant' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Prompting & Controls */}
          <div className="lg:col-span-5 space-y-5">
            {/* Instruction Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  Your Scout Instruction
                </label>
                <span className="text-xs text-slate-400">Natural Language</span>
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Find 5 most trending GTA 5 stunt and drift videos, generate bold yellow subtitles, and save them to GTA-5 Drive folder..."
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
              />

              {/* Quick Presets */}
              <div>
                <p className="text-xs font-medium text-slate-400 mb-2">Quick Presets:</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setPrompt(preset.prompt);
                        setTargetFolder(preset.folder);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Folder Selector */}
              <div className="pt-2 border-t border-slate-800/80">
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Target Folder in Ingest Downloads
                </label>
                <CustomSelect
                  value={targetFolder}
                  onChange={(val) => setTargetFolder(val)}
                  options={FOLDER_OPTIONS}
                  size="md"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Videos found will be routed and saved directly into this folder inside your Ingest Downloads queue.
                </p>
              </div>

              {/* Execution Mode Radio */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-2">
                <label className="text-xs font-medium text-slate-300 block">Execution Mode:</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setAutoIngest(false)}
                    className={`p-2 rounded-lg border text-left transition-colors ${
                      !autoIngest
                        ? 'bg-indigo-950 border-indigo-500 text-white font-medium'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="block font-semibold">Review & Approve</span>
                    <span className="text-[10px] text-slate-400">Inspect picks first</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAutoIngest(true)}
                    className={`p-2 rounded-lg border text-left transition-colors ${
                      autoIngest
                        ? 'bg-indigo-950 border-indigo-500 text-white font-medium'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="block font-semibold">Full Autopilot</span>
                    <span className="text-[10px] text-slate-400">Direct to Ingest Queue</span>
                  </button>
                </div>
              </div>

              {/* Main Submit Button */}
              <button
                disabled={isSearching || !prompt.trim()}
                onClick={handleRunInstantScout}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSearching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    Searching YouTube...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 text-white" />
                    Find Videos
                  </>
                )}
              </button>
            </div>

            {/* Live Terminal Activity Log */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-inner">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${isSearching ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
                  Scout Activity Log
                </span>
                {logs.length > 0 && (
                  <button onClick={() => setLogs([])} className="text-[10px] text-slate-500 hover:text-slate-300">
                    Clear
                  </button>
                )}
              </div>
              <div className="h-44 overflow-y-auto font-mono text-xs text-slate-400 space-y-1 pr-1">
                {logs.length === 0 ? (
                  <p className="text-slate-600 italic">No activity yet. Enter a prompt to begin scouting.</p>
                ) : (
                  logs.map((log, idx) => (
                    <div key={idx} className="leading-tight">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Candidate Review Cards */}
          <div className="lg:col-span-7 space-y-4">
            {scoutResult && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block">Total Scanned</span>
                    <span className="text-white font-bold text-sm">{scoutResult.totalFound}</span>
                  </div>
                  <div className="h-6 w-px bg-slate-800" />
                  <div>
                    <span className="text-slate-400 block">Unique</span>
                    <span className="text-emerald-400 font-bold text-sm">{scoutResult.uniqueCandidates}</span>
                  </div>
                  <div className="h-6 w-px bg-slate-800" />
                  <div>
                    <span className="text-slate-400 block">Duplicates Avoided</span>
                    <span className="text-indigo-400 font-bold text-sm">{scoutResult.alreadySeenCount}</span>
                  </div>
                </div>

                {!autoIngest && scoutResult.selectedVideos.length > 0 && (
                  <button
                    disabled={isBatchQueuing}
                    onClick={handleQueueAllCandidates}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md flex items-center gap-1.5"
                  >
                    {isBatchQueuing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    Queue All {scoutResult.selectedVideos.length} to Drive
                  </button>
                )}
              </div>
            )}

            {/* Candidate Cards Grid */}
            {!scoutResult && !isSearching && (
              <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-500">
                <Video className="w-12 h-12 mx-auto mb-3 text-slate-700" />
                <h3 className="text-base font-semibold text-slate-400 mb-1">No Videos Scouted Yet</h3>
                <p className="text-xs max-w-sm mx-auto text-slate-500">
                  Select a preset on the left or type your custom instruction to have the AI discover, filter, and curate top trending videos for you.
                </p>
              </div>
            )}

            {isSearching && (
              <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-400">
                <RefreshCw className="w-10 h-10 animate-spin mx-auto mb-3 text-indigo-400" />
                <h3 className="text-base font-semibold text-white mb-1">Searching Online Videos</h3>
                <p className="text-xs text-slate-400">
                  Scanning YouTube, cross-referencing de-duplication registry, and ranking candidates by virality...
                </p>
              </div>
            )}

            {scoutResult && scoutResult.selectedVideos.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Selected Winning Clips ({scoutResult.selectedVideos.length}):
                </h3>

                {scoutResult.selectedVideos.map((video, idx) => {
                  const isQueued = queuedIds.has(video.id);
                  return (
                    <div
                      key={video.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-slate-700 transition-all shadow-md"
                    >
                      {/* Left: Thumbnail & Details */}
                      <div className="flex items-start gap-3.5">
                        <div className="relative w-28 h-18 rounded-lg overflow-hidden bg-slate-950 flex-shrink-0 border border-slate-800">
                          {video.thumbnailUrl ? (
                            <img
                              src={video.thumbnailUrl}
                              alt={video.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              <Film className="w-6 h-6" />
                            </div>
                          )}
                          <span className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.2 rounded text-[10px] font-mono text-white">
                            {Math.floor(video.durationSeconds / 60)}:
                            {String(Math.floor(video.durationSeconds % 60)).padStart(2, '0')}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                              Rank #{idx + 1}
                            </span>
                            <span className="text-xs text-slate-400">
                              {video.viewCount.toLocaleString()} views
                            </span>
                          </div>
                          <h4 className="text-sm font-semibold text-white line-clamp-1">{video.title}</h4>
                          {video.aiReason && (
                            <p className="text-xs text-indigo-300/90 mt-1 line-clamp-2">
                              {video.aiReason}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                        <a
                          href={video.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                          title="Preview on YouTube"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </a>

                        <button
                          disabled={isQueued}
                          onClick={() => handleQueueSingleVideo(video)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                            isQueued
                              ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow'
                          }`}
                        >
                          {isQueued ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              Queued
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              Queue to Drive
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AUTOPILOT SCHEDULES VIEW */}
      {activeSubTab === 'schedules' && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div>
              <h2 className="text-base font-bold text-white">Daily Autopilot Loops</h2>
              <p className="text-xs text-slate-400">
                These tasks run autonomously in the background, ensuring 100% unique videos are delivered to your Google Drive every day.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchSchedules}
                disabled={isLoadingSchedules}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingSchedules ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                Create Autopilot Task
              </button>
            </div>
          </div>

          {/* Schedules Grid */}
          {schedules.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
              <Repeat className="w-12 h-12 mx-auto mb-3 text-slate-700" />
              <h3 className="text-base font-semibold text-slate-400 mb-1">No Active Autopilot Tasks</h3>
              <p className="text-xs max-w-sm mx-auto text-slate-500 mb-4">
                Create a recurring daily scout loop (e.g. download 5 GTA 5 stunt videos every day at 9 AM) to put your video pipeline on full autopilot.
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                Create First Task
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {schedules.map((schedule) => {
                const isRunning = scheduleActionId === schedule._id;
                return (
                  <div
                    key={schedule._id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg space-y-4 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              schedule.isActive
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {schedule.isActive ? 'Active Loop' : 'Paused'}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            Folder: {schedule.targetFolder}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-950 text-indigo-300 border border-indigo-800">
                            {schedule.dailyCount} clips/day
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white">{schedule.name}</h3>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleActive(schedule._id, schedule.isActive)}
                          className={`p-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            schedule.isActive
                              ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                              : 'bg-emerald-950 text-emerald-300 border-emerald-700 hover:bg-emerald-900'
                          }`}
                          title={schedule.isActive ? 'Pause Schedule' : 'Activate Schedule'}
                        >
                          {schedule.isActive ? 'Pause' : 'Activate'}
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 line-clamp-2">
                      {schedule.prompt}
                    </p>

                    {/* Stats & Schedule Time */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-950/50 p-2.5 rounded-xl text-center border border-slate-800/60">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Schedule</span>
                        <span className="text-xs font-semibold text-slate-200">
                          {schedule.scheduleType === 'daily'
                            ? `Daily at ${String(schedule.cronHour).padStart(2, '0')}:${String(schedule.cronMinute).padStart(2, '0')}`
                            : `Every ${schedule.intervalHours}h`}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Unique Ingested</span>
                        <span className="text-xs font-semibold text-emerald-400">
                          {schedule.totalIngestedCount || 0} clips
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Duplicates Avoided</span>
                        <span className="text-xs font-semibold text-indigo-400">
                          {schedule.seenVideoIds?.length || 0}
                        </span>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                      <button
                        onClick={() => setHistorySchedule(schedule)}
                        className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                      >
                        <ListOrdered className="w-3.5 h-3.5" />
                        Seen History ({schedule.seenVideoIds?.length || 0})
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={isRunning}
                          onClick={() => handleCloneSchedule(schedule._id, schedule.name)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 font-medium transition-colors"
                          title="Clone this schedule into a new task"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Clone
                        </button>

                        <button
                          disabled={isRunning}
                          onClick={() => handleRunScheduleNow(schedule._id, schedule.name)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1 transition-colors shadow"
                          title="Run now immediately"
                        >
                          {isRunning ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          Run Now
                        </button>

                        <button
                          onClick={() => handleDeleteSchedule(schedule._id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                          title="Delete Schedule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: CREATE SCHEDULE */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Repeat className="w-5 h-5 text-indigo-400" />
                Create New Autopilot Loop
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-500 hover:text-white p-1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Task Name</label>
                <input
                  type="text"
                  value={newScheduleName}
                  onChange={(e) => setNewScheduleName(e.target.value)}
                  placeholder="e.g. Daily GTA 5 Stunt Discovery"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Instruction Prompt</label>
                <textarea
                  value={newSchedulePrompt}
                  onChange={(e) => setNewSchedulePrompt(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Target Folder</label>
                  <CustomSelect
                    value={newScheduleFolder}
                    onChange={(val) => setNewScheduleFolder(val)}
                    options={FOLDER_OPTIONS.filter((f) => f.value !== 'local')}
                    size="sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Daily Video Count</label>
                  <CustomSelect
                    value={String(newScheduleCount)}
                    onChange={(val) => setNewScheduleCount(Number(val))}
                    options={COUNT_OPTIONS}
                    size="sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Run Time (Daily)</label>
                  <CustomSelect
                    value={String(newScheduleHour)}
                    onChange={(val) => setNewScheduleHour(Number(val))}
                    options={HOUR_OPTIONS}
                    size="sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Subtitle Style</label>
                  <CustomSelect
                    value={newScheduleCaptionStyle}
                    onChange={(val) => setNewScheduleCaptionStyle(val as any)}
                    options={CAPTION_STYLE_OPTIONS}
                    size="sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSchedule}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow"
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SEEN VIDEO HISTORY DRAWER */}
      {historySchedule && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-white">De-duplication Registry</h3>
                <p className="text-xs text-slate-400">{historySchedule.name}</p>
              </div>
              <button
                onClick={() => setHistorySchedule(null)}
                className="text-slate-500 hover:text-white p-1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-400 flex-shrink-0">
              These {historySchedule.seenVideoIds?.length || 0} YouTube video IDs will never be downloaded again by this task, ensuring 100% uniqueness on every recurring run:
            </div>

            <div className="overflow-y-auto space-y-2 flex-grow pr-1">
              {historySchedule.seenVideoIds?.length === 0 ? (
                <p className="text-slate-500 italic text-xs py-4 text-center">No videos downloaded yet.</p>
              ) : (
                historySchedule.seenVideoIds?.map((id, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="font-mono text-indigo-300">ID: {id}</span>
                    <a
                      href={`https://www.youtube.com/watch?v=${id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      View on YouTube
                      <ArrowUpRight className="w-3 h-3" />
                    </a>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end flex-shrink-0">
              <button
                onClick={() => setHistorySchedule(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
