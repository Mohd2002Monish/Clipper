'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Workflow,
  GitBranch,
  Layers,
  Clock,
  Sparkles,
  Activity,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Play,
  Flame,
  TrendingUp,
  Share2,
  Youtube,
  Instagram,
  AtSign,
  Plus,
  X,
  Calendar,
  Sliders,
  ShieldCheck,
  Check,
  ExternalLink,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { IWaterfallPipeline, IWaterfallRun } from '@/models/WaterfallPipeline';
import { HourlyHeatmapSlot, RescheduleProposal } from '@/lib/services/autoRescheduleService';

interface AvailableVideo {
  id: string;
  title: string;
  sourceFilename: string;
  sourceType: 'part' | 'drive';
  folderName: string;
  jobId?: string;
  partIndex?: number;
  duration?: number;
  outputPath?: string;
  driveFileId?: string;
  thumbnailUrl?: string;
  createdAt: Date;
}

interface ViralWinner {
  id: string;
  platform: 'threads' | 'instagram';
  username: string;
  titleOrHook: string;
  publishedAt: Date;
  views: number;
  engagement: number;
  metricSummary: string;
}

export function WaterfallSyndicationView() {
  const [activeSubTab, setActiveSubTab] = useState<'waterfall' | 'auto-reschedule' | 'viral-recycler'>('waterfall');

  // Pipelines & Runs state
  const [pipelines, setPipelines] = useState<IWaterfallPipeline[]>([]);
  const [availableVideos, setAvailableVideos] = useState<AvailableVideo[]>([]);
  const [isLoadingPipelines, setIsLoadingPipelines] = useState<boolean>(true);

  // Auto-Reschedule state
  const [heatmap, setHeatmap] = useState<HourlyHeatmapSlot[]>([]);
  const [goldenHours, setGoldenHours] = useState<number[]>([9, 14, 21, 23, 1]);
  const [queueHealth, setQueueHealth] = useState<{
    totalScheduled: number;
    subOptimalSlotsCount: number;
    slotClashesCount: number;
    evergreenWinnersCount: number;
  }>({
    totalScheduled: 0,
    subOptimalSlotsCount: 0,
    slotClashesCount: 0,
    evergreenWinnersCount: 0,
  });
  const [proposals, setProposals] = useState<RescheduleProposal[]>([]);
  const [isAnalyzingQueue, setIsAnalyzingQueue] = useState<boolean>(false);
  const [isApplyingReschedules, setIsApplyingReschedules] = useState<boolean>(false);

  // Viral Winners state
  const [viralWinners, setViralWinners] = useState<ViralWinner[]>([]);
  const [recyclingPostId, setRecyclingPostId] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState<boolean>(false);
  const [selectedVideoForRun, setSelectedVideoForRun] = useState<AvailableVideo | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [isSubmittingRun, setIsSubmittingRun] = useState<boolean>(false);

  // Status message / toast
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const showToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  }, []);

  // Form state for creating a new pipeline
  const [newPipelineForm, setNewPipelineForm] = useState({
    name: 'Primary Shorts -> Reels -> Threads Cascade',
    description: 'Cross-platform syndication with staggered delays and platform-tailored copywriting.',
    folderName: 'General',
    autoSyndicateNewParts: false,
    youtube: {
      enabled: true,
      delayMinutes: 0,
      titleOrHookTemplate: '{title} (Part {part})',
      privacyStatus: 'public' as const,
      videoType: 'short' as const,
    },
    instagram: {
      enabled: true,
      delayMinutes: 120, // 2 hours later
      descriptionOrCaptionTemplate: '{title} (Part {part})\n\nSave this for later & share your thoughts below.\n\n#reels #cinema #viral',
      shareToFeed: true,
    },
    threads: {
      enabled: true,
      delayMinutes: 240, // 4 hours later
      titleOrHookTemplate: '{title} — Part {part}. Did you notice this key moment?',
      ctaReplyText: "I've spent 1000s of hours finding movies that most people never discover. I'm building a curated Movie Vault filled with hidden gems, mind-bending thrillers, and underrated masterpieces. Comment #VAULT if you want early access when it launches.",
    },
  });

  // Fetch Pipelines
  const fetchPipelines = useCallback(async () => {
    try {
      setIsLoadingPipelines(true);
      const res = await fetch('/api/syndication/waterfall');
      const data = await res.json();
      if (data.success) {
        setPipelines(data.pipelines || []);
        setAvailableVideos(data.availableVideos || []);
        if (data.pipelines && data.pipelines.length > 0 && !selectedPipelineId) {
          setSelectedPipelineId(data.pipelines[0]._id);
        }
      }
    } catch {
      showToast('error', 'Failed to load waterfall pipelines.');
    } finally {
      setIsLoadingPipelines(false);
    }
  }, [selectedPipelineId, showToast]);

  // Fetch Analytics & Heatmap
  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/syndication/reschedule');
      const data = await res.json();
      if (data.success) {
        setHeatmap(data.heatmap || []);
        setGoldenHours(data.goldenHours || [9, 14, 21, 23, 1]);
        if (data.queueHealth) setQueueHealth(data.queueHealth);
        if (data.viralWinners) setViralWinners(data.viralWinners);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    fetchPipelines();
    fetchAnalytics();
  }, [fetchPipelines, fetchAnalytics]);

  // Create Pipeline
  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/syndication/waterfall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPipelineForm.name,
          description: newPipelineForm.description,
          folderName: newPipelineForm.folderName,
          autoSyndicateNewParts: newPipelineForm.autoSyndicateNewParts,
          stages: {
            youtube: newPipelineForm.youtube,
            instagram: newPipelineForm.instagram,
            threads: newPipelineForm.threads,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Created pipeline "${newPipelineForm.name}" successfully.`);
        setIsCreateModalOpen(false);
        fetchPipelines();
      } else {
        showToast('error', data.error || 'Failed to create pipeline.');
      }
    } catch (err: unknown) {
      showToast('error', String(err));
    }
  };

  // Trigger Video Run
  const handleTriggerRun = async () => {
    if (!selectedVideoForRun || !selectedPipelineId) return;

    try {
      setIsSubmittingRun(true);
      const res = await fetch(`/api/syndication/waterfall/${selectedPipelineId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoTitle: selectedVideoForRun.title,
          sourceFilename: selectedVideoForRun.sourceFilename,
          folderName: selectedVideoForRun.folderName,
          sourceType: selectedVideoForRun.sourceType,
          localPath: selectedVideoForRun.outputPath,
          driveFileId: selectedVideoForRun.driveFileId,
          jobId: selectedVideoForRun.jobId,
          partIndex: selectedVideoForRun.partIndex,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('success', `Waterfall started for "${selectedVideoForRun.title}". Stages scheduled.`);
        setIsTriggerModalOpen(false);
        fetchPipelines();
      } else {
        showToast('error', data.error || 'Failed to trigger waterfall run.');
      }
    } catch (err: unknown) {
      showToast('error', String(err));
    } finally {
      setIsSubmittingRun(false);
    }
  };

  // Run Auto-Reschedule Queue Sweep (Dry Run)
  const handleAnalyzeQueue = async () => {
    try {
      setIsAnalyzingQueue(true);
      const res = await fetch('/api/syndication/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      });
      const data = await res.json();
      if (data.success) {
        setProposals(data.proposals || []);
        showToast('info', `Analyzed queue: ${data.proposalsCount} slot optimizations identified.`);
      }
    } catch (err: unknown) {
      showToast('error', String(err));
    } finally {
      setIsAnalyzingQueue(false);
    }
  };

  // Apply Reschedules Live
  const handleApplyReschedules = async () => {
    try {
      setIsApplyingReschedules(true);
      const res = await fetch('/api/syndication/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Successfully shifted ${data.proposalsCount} posts to peak Golden Slots.`);
        setProposals([]);
        fetchAnalytics();
      }
    } catch (err: unknown) {
      showToast('error', String(err));
    } finally {
      setIsApplyingReschedules(false);
    }
  };

  // Recycle Viral Post
  const handleRecyclePost = async (platform: 'threads' | 'instagram', postId: string) => {
    try {
      setRecyclingPostId(postId);
      const res = await fetch('/api/syndication/reschedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, postId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          'success',
          `Evergreen winner recycled into Golden Slot (${new Date(data.scheduledAt).toLocaleDateString()} at ${new Date(data.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).`
        );
        fetchAnalytics();
      }
    } catch (err: unknown) {
      showToast('error', String(err));
    } finally {
      setRecyclingPostId(null);
    }
  };

  // Trigger Full Cron Cycle
  const handleTriggerCron = async () => {
    try {
      const res = await fetch('/api/syndication/cron', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(
          'success',
          `Syndication cycle executed: ${data.threads.published} Threads published, ${data.instagram.published} Reels published, ${data.autoReschedule.slotsShifted} slots optimized.`
        );
        fetchPipelines();
        fetchAnalytics();
      }
    } catch (err: unknown) {
      showToast('error', String(err));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 min-h-screen text-slate-800 p-6 md:p-8 flex flex-col gap-6">
      {/* Toast */}
      {statusMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-200 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : statusMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#90CAF9]/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
              <Workflow className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-[#0D47A1] tracking-tight">
              Cross-Platform "Waterfall" Syndication
            </h1>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200">
              Autonomous
            </span>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl">
            Stagger video releases in an orchestrated cascade (YouTube Shorts &rarr; Instagram Reels &rarr; Threads Hook)
            paired with a self-learning Analytics-Driven Auto-Rescheduling Loop that eliminates low-traffic dead slots.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleTriggerCron}
            className="btn-pressable flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition-all"
            title="Execute scheduled publishing and queue sweep immediately"
          >
            <RotateCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Run Sync Cycle</span>
          </button>

          <button
            onClick={() => {
              if (availableVideos.length > 0) {
                setSelectedVideoForRun(availableVideos[0]);
              }
              setIsTriggerModalOpen(true);
            }}
            className="btn-pressable flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition-all"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Trigger on Video</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-pressable flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2196F3] hover:bg-[#1E88E5] text-white font-semibold text-xs shadow-md shadow-[#2196F3]/25 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Pipeline</span>
          </button>
        </div>
      </div>

      {/* Primary Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab('waterfall')}
          className={`btn-pressable flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'waterfall'
              ? 'bg-[#E3F2FD] text-[#0D47A1] border-2 border-[#2196F3] shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
          }`}
        >
          <GitBranch className="w-4 h-4 text-[#2196F3]" />
          <span>Waterfall Pipelines &amp; Runs</span>
          {pipelines.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-[#0D47A1] font-mono">
              {pipelines.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveSubTab('auto-reschedule');
            if (proposals.length === 0) handleAnalyzeQueue();
          }}
          className={`btn-pressable flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'auto-reschedule'
              ? 'bg-[#E3F2FD] text-[#0D47A1] border-2 border-[#2196F3] shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
          }`}
        >
          <Clock className="w-4 h-4 text-purple-600" />
          <span>Auto-Reschedule Loop</span>
          {queueHealth.subOptimalSlotsCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-bold">
              {queueHealth.subOptimalSlotsCount} to fix
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('viral-recycler')}
          className={`btn-pressable flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'viral-recycler'
              ? 'bg-[#E3F2FD] text-[#0D47A1] border-2 border-[#2196F3] shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
          }`}
        >
          <Flame className="w-4 h-4 text-rose-500" />
          <span>Evergreen Viral Recycler</span>
          {viralWinners.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 font-mono">
              {viralWinners.length}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: WATERFALL PIPELINES & RUNS */}
      {/* ========================================================================= */}
      {activeSubTab === 'waterfall' && (
        <div className="flex flex-col gap-6">
          {/* Visual Cascade Timeline Blueprint */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-300">
                  Cascade Sequencing Architecture
                </span>
                <h3 className="text-sm font-bold text-white mt-0.5">
                  Three-Tier Staggered Syndication Flow
                </h3>
              </div>
              <span className="text-xs text-blue-200 bg-white/10 px-3 py-1 rounded-full border border-white/20">
                Prevents audience cannibalization &amp; algorithms saturation
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
              {/* Stage 1: YouTube */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/15 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400">
                        <Youtube className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-white">Stage 1 &bull; YouTube Shorts</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/30 text-red-200 font-bold">
                      T0 (Immediate)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Primary video upload to YouTube channel. Establishes original upload timestamp and initial search authority.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] text-blue-200 font-medium">
                  <span>Format: 9:16 Short</span>
                  <span className="text-emerald-300">Anchor Origin</span>
                </div>
              </div>

              {/* Stage 2: Instagram */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/15 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-pink-500/20 text-pink-400">
                        <Instagram className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-white">Stage 2 &bull; Instagram Reels</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-pink-500/30 text-pink-200 font-bold">
                      T0 + 2 Hours
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Re-angles clip with an Instagram-tailored caption, high-converting hashtags, and share-to-feed switch.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] text-blue-200 font-medium">
                  <span>Format: Reels Feed</span>
                  <span className="text-amber-300">+120m Cascade Offset</span>
                </div>
              </div>

              {/* Stage 3: Threads */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/15 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                        <AtSign className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-white">Stage 3 &bull; Threads Thread</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/30 text-purple-200 font-bold">
                      T0 + 4 Hours
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Opens a viral curiosity loop or spoiler debate, attached video clip, and auto-reply #VAULT community CTA.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] text-blue-200 font-medium">
                  <span>Format: Hook + Video + CTA</span>
                  <span className="text-indigo-300">+240m Cascade Offset</span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Pipelines List */}
          <div className="bg-white rounded-2xl p-6 border border-[#90CAF9]/60 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#0D47A1]">Configured Waterfall Pipelines</h3>
                <p className="text-xs text-slate-600">Active distribution sequences for your channels and accounts</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="btn-pressable flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0D47A1] font-semibold text-xs border border-blue-200"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Pipeline</span>
              </button>
            </div>

            {isLoadingPipelines ? (
              <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                <span>Loading syndication pipelines...</span>
              </div>
            ) : pipelines.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-300 text-center flex flex-col items-center gap-2">
                <GitBranch className="w-8 h-8 text-slate-400" />
                <p className="text-xs font-semibold text-slate-700">No Waterfall Pipelines configured yet</p>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  Create a pipeline to automatically cascade your rendered split parts to YouTube, Instagram, and Threads with smart delays.
                </p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-2 px-4 py-2 rounded-xl bg-[#2196F3] text-white font-semibold text-xs shadow-sm"
                >
                  Create First Pipeline
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pipelines.map((pipe) => (
                  <div
                    key={pipe._id}
                    className="p-5 rounded-xl border border-[#90CAF9]/60 bg-[#F0F7FF] flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-[#0D47A1]">{pipe.name}</h4>
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {pipe.status}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">Folder: {pipe.folderName}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2">{pipe.description}</p>

                      {/* Staged Configuration Badges */}
                      <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                        <span className="flex items-center gap-1 px-2 py-1 rounded bg-white border border-red-200 text-red-700 font-medium">
                          <Youtube className="w-3 h-3 text-red-600" /> YouTube (+{pipe.stages.youtube.delayMinutes}m)
                        </span>
                        <span className="flex items-center gap-1 px-2 py-1 rounded bg-white border border-pink-200 text-pink-700 font-medium">
                          <Instagram className="w-3 h-3 text-pink-600" /> Instagram (+{pipe.stages.instagram.delayMinutes}m)
                        </span>
                        <span className="flex items-center gap-1 px-2 py-1 rounded bg-white border border-purple-200 text-purple-700 font-medium">
                          <AtSign className="w-3 h-3 text-purple-600" /> Threads (+{pipe.stages.threads.delayMinutes}m)
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#90CAF9]/40 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-medium">
                        Runs: <span className="font-bold text-slate-700">{pipe.runs?.length || 0}</span>
                      </span>
                      <button
                        onClick={() => {
                          setSelectedPipelineId(pipe._id || '');
                          if (availableVideos.length > 0) {
                            setSelectedVideoForRun(availableVideos[0]);
                          }
                          setIsTriggerModalOpen(true);
                        }}
                        className="btn-pressable flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2196F3] hover:bg-[#1E88E5] text-white font-semibold text-xs shadow-sm"
                      >
                        <Play className="w-3 h-3" />
                        <span>Run on Video</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Waterfall Runs Table */}
          <div className="bg-white rounded-2xl p-6 border border-[#90CAF9]/60 shadow-sm flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-bold text-[#0D47A1]">Recent Waterfall Cascade Runs</h3>
              <p className="text-xs text-slate-600">Real-time status across multi-stage releases</p>
            </div>

            {pipelines.flatMap((p) => p.runs || []).length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No runs triggered yet. Click "Trigger on Video" above to dispatch your first waterfall cascade.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="pb-3 px-3">Video Title</th>
                      <th className="pb-3 px-3">Folder</th>
                      <th className="pb-3 px-3">Started</th>
                      <th className="pb-3 px-3">YouTube (Stage 1)</th>
                      <th className="pb-3 px-3">Instagram (Stage 2)</th>
                      <th className="pb-3 px-3">Threads (Stage 3)</th>
                      <th className="pb-3 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pipelines
                      .flatMap((p) => p.runs || [])
                      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
                      .slice(0, 15)
                      .map((run) => {
                        const ytStage = run.stages?.find((s) => s.platform === 'youtube');
                        const igStage = run.stages?.find((s) => s.platform === 'instagram');
                        const thStage = run.stages?.find((s) => s.platform === 'threads');

                        return (
                          <tr key={run.runId} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3 font-bold text-slate-800 max-w-[180px] truncate">
                              {run.videoTitle}
                            </td>
                            <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">{run.folderName}</td>
                            <td className="py-3 px-3 text-slate-500 text-[11px]">
                              {new Date(run.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>

                            {/* YouTube Stage */}
                            <td className="py-3 px-3">
                              {ytStage ? (
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                      ytStage.status === 'published'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : ytStage.status === 'scheduled'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {ytStage.status}
                                  </span>
                                  {ytStage.permalink && (
                                    <a
                                      href={ytStage.permalink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[10px]">Disabled</span>
                              )}
                            </td>

                            {/* Instagram Stage */}
                            <td className="py-3 px-3">
                              {igStage ? (
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                      igStage.status === 'published'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : igStage.status === 'scheduled'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {igStage.status}
                                  </span>
                                  {igStage.scheduledAt && igStage.status === 'scheduled' && (
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      {new Date(igStage.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[10px]">Disabled</span>
                              )}
                            </td>

                            {/* Threads Stage */}
                            <td className="py-3 px-3">
                              {thStage ? (
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                      thStage.status === 'published'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : thStage.status === 'scheduled'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {thStage.status}
                                  </span>
                                  {thStage.scheduledAt && thStage.status === 'scheduled' && (
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      {new Date(thStage.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[10px]">Disabled</span>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  run.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : run.status === 'in_progress'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {run.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: ANALYTICS-DRIVEN AUTO-RESCHEDULING LOOP */}
      {/* ========================================================================= */}
      {activeSubTab === 'auto-reschedule' && (
        <div className="flex flex-col gap-6">
          {/* Health Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Upcoming Scheduled</span>
              <div className="text-xl font-bold text-slate-900 mt-1">{queueHealth.totalScheduled} posts</div>
              <span className="text-[10px] text-blue-600 font-medium mt-1">Cross-platform queue</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-amber-800">Sub-Optimal Dead Slots</span>
              <div className="text-xl font-bold text-amber-900 mt-1">{queueHealth.subOptimalSlotsCount} detected</div>
              <span className="text-[10px] text-amber-700 font-medium mt-1">Hours with low viewer retention</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Slot Collisions</span>
              <div className="text-xl font-bold text-slate-900 mt-1">{queueHealth.slotClashesCount} clashes</div>
              <span className="text-[10px] text-slate-500 font-medium mt-1">Posts crowded into same 30m</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-emerald-800">Peak Golden Slots</span>
              <div className="text-xl font-bold text-emerald-900 mt-1">{goldenHours.length} Active</div>
              <span className="text-[10px] text-emerald-700 font-medium mt-1">9 AM, 2 PM, 9 PM, 11 PM, 1 AM</span>
            </div>
          </div>

          {/* 24-Hour Cross-Platform Performance Heatmap */}
          <div className="bg-white rounded-2xl p-6 border border-[#90CAF9]/60 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#0D47A1]">24-Hour Cross-Platform Engagement Heatmap</h3>
                <p className="text-xs text-slate-600">
                  Aggregates views, replies, likes, and saves across YouTube, Instagram Reels, and Threads
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                  <Sparkles className="w-3 h-3 text-amber-600" /> Golden Slots (Peak Velocity)
                </span>
              </div>
            </div>

            {/* Heatmap Bar Grid */}
            <div className="grid grid-cols-6 sm:grid-cols-12 md:grid-cols-24 gap-1 pt-2">
              {heatmap.map((slot) => {
                const isGolden = slot.isGoldenHour;
                const score = slot.engagementScore;

                return (
                  <div key={slot.hour} className="flex flex-col items-center gap-1 group relative">
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none absolute -top-20 z-20 bg-slate-900 text-white text-[10px] p-2 rounded-lg shadow-lg w-36 text-center leading-tight">
                      <div className="font-bold text-blue-300">{slot.label}</div>
                      <div className="text-slate-300 mt-0.5">{slot.audienceContext}</div>
                      <div className="text-emerald-300 font-mono mt-1">Score: {score}/100</div>
                    </div>

                    {/* Bar visualization */}
                    <div className="w-full bg-slate-100 rounded-t h-28 flex items-end p-0.5">
                      <div
                        style={{ height: `${Math.max(12, score)}%` }}
                        className={`w-full rounded-t transition-all ${
                          isGolden
                            ? 'bg-gradient-to-t from-amber-500 to-amber-400 shadow-sm'
                            : score > 50
                            ? 'bg-blue-400'
                            : 'bg-slate-300'
                        }`}
                      />
                    </div>
                    <span
                      className={`text-[9px] font-mono font-bold ${
                        isGolden ? 'text-amber-800 underline' : 'text-slate-500'
                      }`}
                    >
                      {slot.hour}h
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 italic text-center">
              Hover over any hour to view real audience context, impressions history, and retention rating.
            </p>
          </div>

          {/* Interactive Optimization Proposals Panel */}
          <div className="bg-white rounded-2xl p-6 border border-[#90CAF9]/60 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#0D47A1]">Queue Reschedule Optimization Loop</h3>
                <p className="text-xs text-slate-600">
                  Detects scheduled posts stuck in low-engagement hours and shifts them into peak Golden Slots with &plusmn;10m randomized jitter.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAnalyzeQueue}
                  disabled={isAnalyzingQueue}
                  className="btn-pressable flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs border border-slate-300"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzingQueue ? 'animate-spin' : ''}`} />
                  <span>Analyze Queue</span>
                </button>

                {proposals.length > 0 && (
                  <button
                    onClick={handleApplyReschedules}
                    disabled={isApplyingReschedules}
                    className="btn-pressable flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply All ({proposals.length}) Reschedules</span>
                  </button>
                )}
              </div>
            </div>

            {proposals.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <p className="text-xs font-bold text-slate-800">Queue is in Optimal Alignment</p>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  All upcoming scheduled posts are currently aligned to high-velocity Golden Slots. Click "Analyze Queue" anytime to scan for new conflicts.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="pb-3 px-3">Platform</th>
                      <th className="pb-3 px-3">Post Preview</th>
                      <th className="pb-3 px-3">Current Time</th>
                      <th className="pb-3 px-3">Proposed Golden Slot</th>
                      <th className="pb-3 px-3">Optimization Rationale</th>
                      <th className="pb-3 px-3">Estimated Lift</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {proposals.map((prop) => (
                      <tr key={prop.postId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3">
                          <span
                            className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded flex items-center gap-1 w-fit ${
                              prop.platform === 'threads'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-pink-100 text-pink-800 border border-pink-200'
                            }`}
                          >
                            {prop.platform === 'threads' ? (
                              <AtSign className="w-3 h-3" />
                            ) : (
                              <Instagram className="w-3 h-3" />
                            )}
                            {prop.platform}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800 max-w-[200px] truncate">
                          {prop.previewText}
                        </td>
                        <td className="py-3 px-3 font-mono text-rose-700 bg-rose-50/50 rounded text-[11px]">
                          {new Date(prop.currentScheduleAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-800 bg-emerald-50 rounded text-[11px]">
                          {new Date(prop.proposedScheduleAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          <span className="text-[9px] text-emerald-600 block">(&plusmn;8m jitter)</span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 text-[11px] max-w-[220px]">{prop.reason}</td>
                        <td className="py-3 px-3 text-emerald-700 font-bold text-[11px]">
                          {prop.engagementLiftEstimate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: EVERGREEN VIRAL RECYCLER */}
      {/* ========================================================================= */}
      {activeSubTab === 'viral-recycler' && (
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-2xl p-6 border border-[#90CAF9]/60 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#0D47A1]">Evergreen High-Retention Winners</h3>
                <p className="text-xs text-slate-600">
                  Automatically tracks viral outperformer clips (&gt;1.5x account average) and allows 1-click recycling into upcoming prime slots.
                </p>
              </div>
              <span className="text-xs text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200 font-semibold">
                Compounding Audience Growth
              </span>
            </div>

            {viralWinners.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No published winners detected yet. Once posts begin accumulating views and replies, top performers will appear here.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {viralWinners.map((winner) => (
                  <div
                    key={winner.id}
                    className="p-5 rounded-xl border border-slate-200 bg-white hover:border-[#2196F3] shadow-sm transition-all flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                            winner.platform === 'threads'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-pink-100 text-pink-800'
                          }`}
                        >
                          {winner.platform === 'threads' ? (
                            <AtSign className="w-3 h-3" />
                          ) : (
                            <Instagram className="w-3 h-3" />
                          )}
                          @{winner.username}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(winner.publishedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 line-clamp-3 mb-2">{winner.titleOrHook}</p>
                      <div className="text-[11px] text-slate-500 font-mono" dangerouslySetInnerHTML={{ __html: winner.metricSummary }} />
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> High Retention
                      </span>
                      <button
                        onClick={() => handleRecyclePost(winner.platform, winner.id)}
                        disabled={recyclingPostId === winner.id}
                        className="btn-pressable flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm"
                      >
                        <RotateCw className={`w-3 h-3 ${recyclingPostId === winner.id ? 'animate-spin' : ''}`} />
                        <span>Recycle to Peak Slot</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE NEW PIPELINE */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Workflow className="w-5 h-5 text-[#2196F3]" />
                <h3 className="text-base font-bold text-slate-900">Create Waterfall Pipeline</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePipeline} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Pipeline Name</label>
                <input
                  type="text"
                  required
                  value={newPipelineForm.name}
                  onChange={(e) => setNewPipelineForm({ ...newPipelineForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Associated Content Folder</label>
                <input
                  type="text"
                  value={newPipelineForm.folderName}
                  onChange={(e) => setNewPipelineForm({ ...newPipelineForm, folderName: e.target.value })}
                  placeholder="e.g. General or Bollywood Highlights"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>

              {/* Stage Settings */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Cascade Delays &amp; Staggered Rules
                </h4>

                {/* Stage 1: YouTube */}
                <div className="flex flex-col gap-2 p-3 rounded-lg bg-white border border-red-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-red-700 flex items-center gap-1.5">
                      <Youtube className="w-4 h-4 text-red-600" /> Stage 1: YouTube Shorts
                    </span>
                    <span className="text-[10px] text-slate-500">Delay: 0m (Anchor)</span>
                  </div>
                  <input
                    type="text"
                    value={newPipelineForm.youtube.titleOrHookTemplate}
                    onChange={(e) =>
                      setNewPipelineForm({
                        ...newPipelineForm,
                        youtube: { ...newPipelineForm.youtube, titleOrHookTemplate: e.target.value },
                      })
                    }
                    placeholder="Title template: e.g. {title} (Part {part})"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                  />
                </div>

                {/* Stage 2: Instagram */}
                <div className="flex flex-col gap-2 p-3 rounded-lg bg-white border border-pink-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-pink-700 flex items-center gap-1.5">
                      <Instagram className="w-4 h-4 text-pink-600" /> Stage 2: Instagram Reels
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500">Delay:</span>
                      <input
                        type="number"
                        min="0"
                        value={newPipelineForm.instagram.delayMinutes}
                        onChange={(e) =>
                          setNewPipelineForm({
                            ...newPipelineForm,
                            instagram: {
                              ...newPipelineForm.instagram,
                              delayMinutes: parseInt(e.target.value, 10) || 0,
                            },
                          })
                        }
                        className="w-16 px-1.5 py-0.5 rounded border border-slate-300 text-center font-mono text-xs"
                      />
                      <span className="text-[10px] text-slate-500">mins</span>
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    value={newPipelineForm.instagram.descriptionOrCaptionTemplate}
                    onChange={(e) =>
                      setNewPipelineForm({
                        ...newPipelineForm,
                        instagram: {
                          ...newPipelineForm.instagram,
                          descriptionOrCaptionTemplate: e.target.value,
                        },
                      })
                    }
                    placeholder="Caption template"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                  />
                </div>

                {/* Stage 3: Threads */}
                <div className="flex flex-col gap-2 p-3 rounded-lg bg-white border border-purple-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-700 flex items-center gap-1.5">
                      <AtSign className="w-4 h-4 text-purple-600" /> Stage 3: Threads Thread &amp; CTA
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500">Delay:</span>
                      <input
                        type="number"
                        min="0"
                        value={newPipelineForm.threads.delayMinutes}
                        onChange={(e) =>
                          setNewPipelineForm({
                            ...newPipelineForm,
                            threads: {
                              ...newPipelineForm.threads,
                              delayMinutes: parseInt(e.target.value, 10) || 0,
                            },
                          })
                        }
                        className="w-16 px-1.5 py-0.5 rounded border border-slate-300 text-center font-mono text-xs"
                      />
                      <span className="text-[10px] text-slate-500">mins</span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={newPipelineForm.threads.titleOrHookTemplate}
                    onChange={(e) =>
                      setNewPipelineForm({
                        ...newPipelineForm,
                        threads: { ...newPipelineForm.threads, titleOrHookTemplate: e.target.value },
                      })
                    }
                    placeholder="Opening hook tweet"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                  />
                  <textarea
                    rows={2}
                    value={newPipelineForm.threads.ctaReplyText}
                    onChange={(e) =>
                      setNewPipelineForm({
                        ...newPipelineForm,
                        threads: { ...newPipelineForm.threads, ctaReplyText: e.target.value },
                      })
                    }
                    placeholder="Auto-reply CTA (e.g. #VAULT)"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#2196F3] hover:bg-[#1E88E5] text-white font-bold text-xs shadow-md"
                >
                  Save Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: TRIGGER WATERFALL ON VIDEO */}
      {/* ========================================================================= */}
      {isTriggerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xl max-w-lg w-full flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Trigger Waterfall Syndication</h3>
              </div>
              <button
                onClick={() => setIsTriggerModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Video Part / File</label>
                {availableVideos.length === 0 ? (
                  <p className="text-slate-500 italic p-3 rounded-xl bg-slate-50 border">
                    No rendered parts found. Render a video job in the Studio first.
                  </p>
                ) : (
                  <select
                    value={selectedVideoForRun?.id || ''}
                    onChange={(e) => {
                      const v = availableVideos.find((item) => item.id === e.target.value);
                      if (v) setSelectedVideoForRun(v);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none text-xs font-medium"
                  >
                    {availableVideos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title} ({v.sourceFilename}) &bull; {v.folderName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Pipeline</label>
                <select
                  value={selectedPipelineId}
                  onChange={(e) => setSelectedPipelineId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none text-xs font-medium"
                >
                  {pipelines.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.folderName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 text-blue-900 flex flex-col gap-1 text-[11px]">
                <span className="font-bold">What happens next:</span>
                <span>&bull; YouTube upload begins immediately at T0.</span>
                <span>&bull; Instagram Reel is queued for T0 + 2 hours with hashtag optimization.</span>
                <span>&bull; Threads discussion post is queued for T0 + 4 hours with auto-reply #VAULT CTA.</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsTriggerModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedVideoForRun || isSubmittingRun}
                onClick={handleTriggerRun}
                className="btn-pressable flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/25 disabled:opacity-50"
              >
                {isSubmittingRun ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Initiating Cascade...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Start Waterfall</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
