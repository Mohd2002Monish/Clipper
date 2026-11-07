'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Folder,
  Youtube,
  Instagram,
  Facebook,
  AtSign,
  Play,
  Pause,
  Trash2,
  Plus,
  RefreshCw,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Settings2,
  Image as ImageIcon,
  FileText,
  Hash,
  ShieldCheck,
  X,
  Share2,
  Check,
  Sliders,
  ArrowRight,
  Copy,
} from 'lucide-react';
import { NoticeModal } from './ui/NoticeModal';

interface PipelineTargetYouTube {
  enabled: boolean;
  channelId?: string;
  channelTitle?: string;
  privacyStatus?: 'public' | 'unlisted' | 'private';
  videoType?: 'short' | 'long_form';
}

interface PipelineTargetInstagram {
  enabled: boolean;
  accountId?: string;
  username?: string;
  shareToFeed?: boolean;
}

interface PipelineTargetFacebook {
  enabled: boolean;
  accountId?: string;
  pageId?: string;
  pageName?: string;
}

interface PipelineTargetThreads {
  enabled: boolean;
  accountId?: string;
  username?: string;
  topic?: string;
}

interface PipelineItem {
  _id: string;
  name: string;
  folderName: string;
  folderId?: string;
  targets: {
    youtube: PipelineTargetYouTube;
    instagram: PipelineTargetInstagram;
    facebook: PipelineTargetFacebook;
    threads: PipelineTargetThreads;
  };
  captions: {
    mode?: 'unified' | 'individual';
    template: string;
    hashtags: string[];
    enableVaultCta: boolean;
    customOverrides?: {
      youtube?: string;
      instagram?: string;
      facebook?: string;
      threads?: string;
    };
  };
  thumbnails: {
    mode: 'auto_frame' | 'drive_companion' | 'custom_uploaded';
    frameTimestampSeconds: number;
    individualMode?: boolean;
    channelOverrides?: {
      youtube?: { mode?: string; frameTimestampSeconds?: number };
      instagram?: { mode?: string; frameTimestampSeconds?: number };
      facebook?: { mode?: string; frameTimestampSeconds?: number };
      threads?: { mode?: string; frameTimestampSeconds?: number };
    };
  };
  schedule: {
    mode: 'golden_slots' | 'interval' | 'manual';
    goldenSlots: number[];
    intervalHours: number;
    dailyLimit: number;
    lastRunAt?: string;
    nextRunSlot?: string;
  };
  stats: {
    totalVideosProcessed: number;
    totalPostsCreated: number;
    lastVideoTitle?: string;
    postedVideoIds: string[];
  };
  status: 'active' | 'paused' | 'completed';
  createdAt: string;
}

interface AccountsSummary {
  youtube: Array<{ channelId: string; channelTitle: string }>;
  instagram: Array<{ accountId: string; username: string }>;
  facebook: Array<{ accountId: string; pageId: string; pageName: string }>;
  threads: Array<{ accountId: string; username: string }>;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

export function OmniPipelineManagerView() {
  const [pipelines, setPipelines] = useState<PipelineItem[]>([]);
  const [accounts, setAccounts] = useState<AccountsSummary>({
    youtube: [],
    instagram: [],
    facebook: [],
    threads: [],
  });
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [runningPipelineId, setRunningPipelineId] = useState<string | null>(null);

  // Modal Wizard State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Step 1: Source & Identity
  const [formName, setFormName] = useState('');
  const [formFolder, setFormFolder] = useState('Shorts');

  // Step 2: Channel selections
  const [targetYt, setTargetYt] = useState(true);
  const [targetYtChannel, setTargetYtChannel] = useState('');

  const [targetIg, setTargetIg] = useState(true);
  const [targetIgAccount, setTargetIgAccount] = useState('');

  const [targetFb, setTargetFb] = useState(false);
  const [targetFbPage, setTargetFbPage] = useState('');

  const [targetTh, setTargetTh] = useState(true);
  const [targetThAccount, setTargetThAccount] = useState('');

  // Step 3: Captions
  const [captionMode, setCaptionMode] = useState<'unified' | 'individual'>('unified');
  const [captionTemplate, setCaptionTemplate] = useState(
    '{{title}}\n\nFollow for more curated cinema moments.\n\n{{hashtags}}'
  );
  const [hashtagsStr, setHashtagsStr] = useState('#Shorts, #Cinema, #MovieVault, #Bollywood, #FilmLovers');
  const [enableVaultCta, setEnableVaultCta] = useState(true);
  const [activeCaptionTab, setActiveCaptionTab] = useState<'youtube' | 'instagram' | 'facebook' | 'threads'>('youtube');
  const [customCaptions, setCustomCaptions] = useState<{
    youtube: string;
    instagram: string;
    facebook: string;
    threads: string;
  }>({
    youtube: '{{title}}\n\nWatch till the end! Like and subscribe for more daily cinema discoveries.\n\n{{hashtags}}',
    instagram: '{{title}}\n\nSave this for your next movie night. Share with a film lover.\n\n{{hashtags}}',
    facebook: '{{title}}\n\nWhat are your thoughts on this scene? Comment below.\n\n{{hashtags}}',
    threads: '{{title}}\n\nThoughts on this? #MovieVault',
  });

  // Step 4: Thumbnails
  const [thumbnailMode, setThumbnailMode] = useState<'unified' | 'individual'>('unified');
  const [thumbExtractMode, setThumbExtractMode] = useState<'auto_frame' | 'drive_companion'>('auto_frame');
  const [thumbTimestamp, setThumbTimestamp] = useState(1.0);
  const [activeThumbTab, setActiveThumbTab] = useState<'youtube' | 'instagram' | 'facebook' | 'threads'>('youtube');
  const [channelThumbnails, setChannelThumbnails] = useState<{
    youtube: { frameTimestampSeconds: number };
    instagram: { frameTimestampSeconds: number };
    facebook: { frameTimestampSeconds: number };
    threads: { frameTimestampSeconds: number };
  }>({
    youtube: { frameTimestampSeconds: 1.5 },
    instagram: { frameTimestampSeconds: 1.0 },
    facebook: { frameTimestampSeconds: 1.0 },
    threads: { frameTimestampSeconds: 1.0 },
  });

  // Step 5: Schedule
  const [scheduleMode, setScheduleMode] = useState<'golden_slots' | 'interval' | 'manual'>('golden_slots');
  const [intervalHours, setIntervalHours] = useState(4);
  const [dailyLimit, setDailyLimit] = useState(5);

  const [notice, setNotice] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const fetchPipelines = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/pipelines');
      const data = await res.json();
      if (data.success) {
        setPipelines(data.pipelines || []);
        if (data.accounts) setAccounts(data.accounts);
        if (data.folders) setFolders(data.folders);

        // Pre-select first accounts if available and not yet set
        if (data.accounts?.youtube?.[0] && !targetYtChannel) {
          setTargetYtChannel(data.accounts.youtube[0].channelId);
        }
        if (data.accounts?.instagram?.[0] && !targetIgAccount) {
          setTargetIgAccount(data.accounts.instagram[0].accountId);
        }
        if (data.accounts?.facebook?.[0] && !targetFbPage) {
          setTargetFbPage(data.accounts.facebook[0].accountId);
        }
        if (data.accounts?.threads?.[0] && !targetThAccount) {
          setTargetThAccount(data.accounts.threads[0].accountId);
        }
      }
    } catch {
      // Graceful error
    } finally {
      setIsLoading(false);
    }
  }, [targetYtChannel, targetIgAccount, targetFbPage, targetThAccount]);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  // Quick folder selector that auto-sets pipeline name if blank
  const handleSelectFolder = (folderName: string) => {
    setFormFolder(folderName);
    if (!formName.trim() || formName.includes('Auto-Pilot')) {
      setFormName(`${folderName} Omni Auto-Pilot`);
    }
  };

  const selectedChannelsCount =
    (targetYt ? 1 : 0) +
    (targetIg ? 1 : 0) +
    (targetFb ? 1 : 0) +
    (targetTh ? 1 : 0);

  // Return selected channel keys
  const getSelectedChannelKeys = (): Array<'youtube' | 'instagram' | 'facebook' | 'threads'> => {
    const list: Array<'youtube' | 'instagram' | 'facebook' | 'threads'> = [];
    if (targetYt) list.push('youtube');
    if (targetIg) list.push('instagram');
    if (targetFb) list.push('facebook');
    if (targetTh) list.push('threads');
    return list;
  };

  // Ensure active tab stays in selected channels
  useEffect(() => {
    const selected = getSelectedChannelKeys();
    if (selected.length > 0) {
      if (!selected.includes(activeCaptionTab)) {
        setActiveCaptionTab(selected[0]);
      }
      if (!selected.includes(activeThumbTab)) {
        setActiveThumbTab(selected[0]);
      }
    }
  }, [targetYt, targetIg, targetFb, targetTh]);

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!formName.trim()) {
        setNotice({
          isOpen: true,
          title: 'Pipeline Name Required',
          message: 'Please enter a descriptive name for this auto-pilot pipeline.',
          type: 'error',
        });
        return;
      }
      if (!formFolder.trim()) {
        setNotice({
          isOpen: true,
          title: 'Source Folder Required',
          message: 'Please choose a Google Drive folder containing your videos.',
          type: 'error',
        });
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (selectedChannelsCount === 0) {
        setNotice({
          isOpen: true,
          title: 'Destination Channel Required',
          message: 'Please select at least one social channel (YouTube, Instagram, Facebook, or Threads).',
          type: 'error',
        });
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4);
    } else if (currentStep === 4) {
      setCurrentStep(5);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  };

  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setNotice({ isOpen: true, title: 'Validation Error', message: 'Please provide a pipeline name.', type: 'error' });
      return;
    }

    if (selectedChannelsCount === 0) {
      setNotice({ isOpen: true, title: 'Channel Selection Required', message: 'Please select at least one publishing platform.', type: 'error' });
      return;
    }

    const selectedYtObj = accounts.youtube.find((a) => a.channelId === targetYtChannel);
    const selectedIgObj = accounts.instagram.find((a) => a.accountId === targetIgAccount);
    const selectedFbObj = accounts.facebook.find((a) => a.accountId === targetFbPage);
    const selectedThObj = accounts.threads.find((a) => a.accountId === targetThAccount);

    const tagsArray = hashtagsStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : `#${t}`));

    const payload = {
      name: formName.trim(),
      folderName: formFolder,
      targets: {
        youtube: {
          enabled: targetYt,
          channelId: targetYtChannel,
          channelTitle: selectedYtObj?.channelTitle || 'YouTube Channel',
          privacyStatus: 'public',
          videoType: 'short',
        },
        instagram: {
          enabled: targetIg,
          accountId: targetIgAccount,
          username: selectedIgObj?.username || 'instagram_user',
          shareToFeed: true,
        },
        facebook: {
          enabled: targetFb,
          accountId: targetFbPage,
          pageId: selectedFbObj?.pageId || 'fb_page',
          pageName: selectedFbObj?.pageName || 'Facebook Page',
        },
        threads: {
          enabled: targetTh,
          accountId: targetThAccount,
          username: selectedThObj?.username || 'threads_user',
          topic: 'Movies',
        },
      },
      captions: {
        mode: captionMode,
        template: captionTemplate,
        hashtags: tagsArray,
        enableVaultCta,
        customOverrides:
          captionMode === 'individual'
            ? {
                youtube: targetYt ? customCaptions.youtube : undefined,
                instagram: targetIg ? customCaptions.instagram : undefined,
                facebook: targetFb ? customCaptions.facebook : undefined,
                threads: targetTh ? customCaptions.threads : undefined,
              }
            : undefined,
      },
      thumbnails: {
        mode: thumbExtractMode,
        frameTimestampSeconds: thumbTimestamp,
        individualMode: thumbnailMode === 'individual',
        channelOverrides:
          thumbnailMode === 'individual'
            ? {
                youtube: targetYt ? { mode: 'auto_frame', frameTimestampSeconds: channelThumbnails.youtube.frameTimestampSeconds } : undefined,
                instagram: targetIg ? { mode: 'auto_frame', frameTimestampSeconds: channelThumbnails.instagram.frameTimestampSeconds } : undefined,
                facebook: targetFb ? { mode: 'auto_frame', frameTimestampSeconds: channelThumbnails.facebook.frameTimestampSeconds } : undefined,
                threads: targetTh ? { mode: 'auto_frame', frameTimestampSeconds: channelThumbnails.threads.frameTimestampSeconds } : undefined,
              }
            : undefined,
      },
      schedule: {
        mode: scheduleMode,
        goldenSlots: [9, 14, 21, 23, 1],
        intervalHours,
        dailyLimit,
      },
    };

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setCurrentStep(1);
        setNotice({
          isOpen: true,
          title: 'Pipeline Activated',
          message: `Multi-Channel Pipeline "${formName}" is now active and watching Drive folder "${formFolder}".`,
          type: 'success',
        });
        setFormName('');
        fetchPipelines();
      } else {
        setNotice({ isOpen: true, title: 'Error', message: data.error || 'Failed to create pipeline.', type: 'error' });
      }
    } catch {
      setNotice({ isOpen: true, title: 'Error', message: 'Network communication failure.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriggerPipeline = async (id: string, name: string) => {
    try {
      setRunningPipelineId(id);
      const res = await fetch(`/api/pipelines/${id}/trigger`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setNotice({
          isOpen: true,
          title: 'Pipeline Syndication Succeeded',
          message: `Published "${data.videoTitle}" across connected channels successfully.`,
          type: 'success',
        });
        fetchPipelines();
      } else {
        setNotice({
          isOpen: true,
          title: 'Pipeline Notice',
          message: data.message || 'Could not process next video in folder.',
          type: 'info',
        });
      }
    } catch {
      setNotice({ isOpen: true, title: 'Error', message: 'Could not contact pipeline trigger endpoint.', type: 'error' });
    } finally {
      setRunningPipelineId(null);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`/api/pipelines/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setPipelines((prev) =>
          prev.map((p) => (p._id === id ? { ...p, status: nextStatus as any } : p))
        );
      }
    } catch {}
  };

  const handleDeletePipeline = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pipeline?')) return;
    try {
      const res = await fetch(`/api/pipelines/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setPipelines((prev) => prev.filter((p) => p._id !== id));
      }
    } catch {}
  };

  const totalSyndicated = pipelines.reduce((sum, p) => sum + (p.stats?.totalVideosProcessed || 0), 0);
  const totalPosts = pipelines.reduce((sum, p) => sum + (p.stats?.totalPostsCreated || 0), 0);

  const selectedChannelsList = getSelectedChannelKeys();

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full animate-fadeIn pb-16">
      {/* Top Banner Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 md:p-8 text-white shadow-xl border border-blue-800/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold tracking-wide border border-white/20">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Multi-Channel Auto-Pilot Pipelines</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              One Drive Folder &rarr; Multi-Channel Auto-Posting
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl font-medium leading-relaxed">
              Select your Google Drive folder, choose your destination channels, customize thumbnails and captions individually or unified, and let the auto-pilot syndicate on your schedule.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={fetchPipelines}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
              title="Refresh Pipelines"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-300' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentStep(1);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs tracking-wide shadow-lg shadow-sky-500/30 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Create Pipeline</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Pipelines</div>
          <div className="text-2xl font-black text-slate-900">
            {pipelines.filter((p) => p.status === 'active').length}
          </div>
          <div className="text-[10px] text-slate-500 font-medium">Watching Drive folders</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Videos Syndicated</div>
          <div className="text-2xl font-black text-blue-600">{totalSyndicated}</div>
          <div className="text-[10px] text-slate-500 font-medium">Unique clips dispatched</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Posts Generated</div>
          <div className="text-2xl font-black text-emerald-600">{totalPosts}</div>
          <div className="text-[10px] text-slate-500 font-medium">Across all platforms</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Schedule Engine</div>
          <div className="text-sm font-bold text-amber-700 flex items-center gap-1.5 pt-1">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>5 Golden Slots Active</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium">9 AM, 2 PM, 9 PM, 11 PM, 1 AM</div>
        </div>
      </div>

      {/* Active Pipelines Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Configured Pipelines</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold font-mono">
              {pipelines.length}
            </span>
          </h2>
        </div>

        {pipelines.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
              <Folder className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Multi-Channel Pipelines Configured Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Create your first pipeline by selecting a Drive folder (e.g. &ldquo;Shorts&rdquo; or &ldquo;Movie-Vault&rdquo;) and selecting your target accounts across YouTube, Instagram, Facebook, and Threads.
            </p>
            <button
              type="button"
              onClick={() => {
                setCurrentStep(1);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Pipeline</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pipelines.map((pipeline) => {
              const isRunning = runningPipelineId === pipeline._id;
              const hasYt = pipeline.targets.youtube?.enabled;
              const hasIg = pipeline.targets.instagram?.enabled;
              const hasFb = pipeline.targets.facebook?.enabled;
              const hasTh = pipeline.targets.threads?.enabled;

              return (
                <div
                  key={pipeline._id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 flex flex-col justify-between gap-4 hover:border-blue-400 transition-all"
                >
                  <div className="space-y-3">
                    {/* Header line: Title & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black text-slate-900">{pipeline.name}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                          <Folder className="w-3.5 h-3.5 text-blue-600" />
                          <span>Source Folder:</span>
                          <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            {pipeline.folderName}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          pipeline.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            pipeline.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                          }`}
                        />
                        {pipeline.status === 'active' ? 'Active Auto-Pilot' : 'Paused'}
                      </span>
                    </div>

                    {/* Destination Channels Badges */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Destination Channels
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {hasYt && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                            <Youtube className="w-3 h-3 text-red-600" />
                            <span>{pipeline.targets.youtube.channelTitle || 'YouTube Shorts'}</span>
                          </span>
                        )}
                        {hasIg && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-pink-50 text-pink-700 border border-pink-200">
                            <Instagram className="w-3 h-3 text-pink-600" />
                            <span>@{pipeline.targets.instagram.username || 'flimyapper'}</span>
                          </span>
                        )}
                        {hasFb && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Facebook className="w-3 h-3 text-blue-600" />
                            <span>{pipeline.targets.facebook.pageName || 'Facebook Page'}</span>
                          </span>
                        )}
                        {hasTh && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            <AtSign className="w-3 h-3 text-slate-600" />
                            <span>@{pipeline.targets.threads.username || 'flimyapper'}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Captions & Thumbnail Meta */}
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 font-medium">
                        <FileText className="w-3 h-3 text-slate-600" />
                        <span>Captions: {pipeline.captions?.mode === 'individual' ? 'Per-Channel' : 'Unified'}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 font-medium">
                        <ImageIcon className="w-3 h-3 text-slate-600" />
                        <span>Thumbnails: {pipeline.thumbnails?.individualMode ? 'Per-Channel' : `${pipeline.thumbnails?.frameTimestampSeconds || 1.0}s Frame`}</span>
                      </span>
                    </div>

                    {/* Stats & Last Video */}
                    <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Total Videos Posted:</span>
                        <span className="font-bold text-slate-800">{pipeline.stats?.totalVideosProcessed || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Total Posts Dispatched:</span>
                        <span className="font-bold text-emerald-700">{pipeline.stats?.totalPostsCreated || 0}</span>
                      </div>
                      {pipeline.stats?.lastVideoTitle ? (
                        <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Last Posted:</span>
                          <span className="font-semibold text-slate-700 truncate max-w-[200px]" title={pipeline.stats.lastVideoTitle}>
                            {pipeline.stats.lastVideoTitle}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(pipeline._id, pipeline.status)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                        title={pipeline.status === 'active' ? 'Pause Pipeline' : 'Resume Pipeline'}
                      >
                        {pipeline.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePipeline(pipeline._id)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete Pipeline"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => handleTriggerPipeline(pipeline._id, pipeline.name)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs text-white transition-all shadow-sm ${
                        isRunning
                          ? 'bg-blue-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                      }`}
                    >
                      {isRunning ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Publishing Next...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Post Next Video Now</span>
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

      {/* Complete Step-by-Step Pipeline Creation Wizard Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 md:p-8 shadow-2xl border border-slate-100 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="space-y-0.5">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600" />
                  <span>Create Auto-Pilot Pipeline</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Effortless 5-step setup: select Drive folder &rarr; pick channels &rarr; customize captions &amp; thumbnails &rarr; schedule.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Header Pills */}
            <div className="py-4 border-b border-slate-100 shrink-0">
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {[
                  { step: 1, label: 'Folder', icon: Folder },
                  { step: 2, label: 'Channels', icon: Share2 },
                  { step: 3, label: 'Captions', icon: FileText },
                  { step: 4, label: 'Thumbnails', icon: ImageIcon },
                  { step: 5, label: 'Schedule', icon: Clock },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = currentStep === item.step;
                  const isCompleted = currentStep > item.step;

                  return (
                    <button
                      key={item.step}
                      type="button"
                      onClick={() => {
                        // Allow clicking back or to current
                        if (item.step <= currentStep) {
                          setCurrentStep(item.step as WizardStep);
                        }
                      }}
                      className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30'
                          : isCompleted
                          ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer'
                          : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        <Icon className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="py-5 overflow-y-auto grow space-y-6 pr-1">
              {/* STEP 1: DRIVE FOLDER & NAME */}
              {currentStep === 1 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Folder className="w-4 h-4 text-blue-600" />
                      <span>Select Source Drive Folder</span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      Pick the Google Drive folder where your ready-to-post videos reside. The pipeline continuously monitors this folder.
                    </p>
                  </div>

                  {/* Folder Selection Grid */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Drive Folder Presets
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {['Shorts', 'Movie-Vault', 'GTA-5', 'General'].map((name) => {
                        const isSelected = formFolder === name;
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => handleSelectFolder(name)}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                              isSelected
                                ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 font-bold'
                                : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 font-medium'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <Folder className={`w-5 h-5 ${isSelected ? 'text-blue-600 fill-blue-100' : 'text-slate-400'}`} />
                              {isSelected && <Check className="w-4 h-4 text-blue-600 stroke-[3]" />}
                            </div>
                            <span className="text-xs">{name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom folder selection dropdown if additional folders available */}
                  {folders.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Or Pick from Detected Drive Subfolders
                      </label>
                      <select
                        value={formFolder}
                        onChange={(e) => handleSelectFolder(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 bg-white"
                      >
                        {folders.map((f) => (
                          <option key={f.id} value={f.name}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Pipeline Name Input */}
                  <div className="space-y-1.5 pt-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Pipeline Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Movie Vault Shorts Auto-Pilot"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                    />
                    <p className="text-[11px] text-slate-400">
                      A clear name helps identify this pipeline in your active schedules.
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 2: MULTI-CHANNEL SELECTION */}
              {currentStep === 2 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Share2 className="w-4 h-4 text-blue-600" />
                        <span>Select Destination Channels</span>
                      </h4>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                        {selectedChannelsCount} Selected
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      All your connected accounts are listed below. Check the channels where every video from &ldquo;{formFolder}&rdquo; should be published.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* YouTube Channel Card */}
                    <div
                      onClick={() => setTargetYt(!targetYt)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        targetYt
                          ? 'bg-red-50/60 border-red-400 ring-2 ring-red-400/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Youtube className="w-5 h-5 fill-current" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">YouTube Shorts</div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {accounts.youtube.length > 0
                                ? accounts.youtube.find((a) => a.channelId === targetYtChannel)?.channelTitle || accounts.youtube[0].channelTitle
                                : 'No account connected'}
                            </div>
                          </div>
                        </div>

                        <input
                          type="checkbox"
                          checked={targetYt}
                          onChange={(e) => {
                            e.stopPropagation();
                            setTargetYt(e.target.checked);
                          }}
                          className="w-4 h-4 rounded text-red-600 focus:ring-red-500 mt-1 cursor-pointer"
                        />
                      </div>

                      {targetYt && accounts.youtube.length > 1 && (
                        <div onClick={(e) => e.stopPropagation()} className="pt-2 border-t border-red-200/60">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Select YouTube Channel
                          </label>
                          <select
                            value={targetYtChannel}
                            onChange={(e) => setTargetYtChannel(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-red-200 text-xs text-slate-900 bg-white focus:outline-none"
                          >
                            {accounts.youtube.map((a) => (
                              <option key={a.channelId} value={a.channelId}>
                                {a.channelTitle}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Instagram Page Card */}
                    <div
                      onClick={() => setTargetIg(!targetIg)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        targetIg
                          ? 'bg-pink-50/60 border-pink-400 ring-2 ring-pink-400/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Instagram className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">Instagram Reels</div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {accounts.instagram.length > 0
                                ? `@${accounts.instagram.find((a) => a.accountId === targetIgAccount)?.username || accounts.instagram[0].username}`
                                : 'No account connected'}
                            </div>
                          </div>
                        </div>

                        <input
                          type="checkbox"
                          checked={targetIg}
                          onChange={(e) => {
                            e.stopPropagation();
                            setTargetIg(e.target.checked);
                          }}
                          className="w-4 h-4 rounded text-pink-600 focus:ring-pink-500 mt-1 cursor-pointer"
                        />
                      </div>

                      {targetIg && accounts.instagram.length > 1 && (
                        <div onClick={(e) => e.stopPropagation()} className="pt-2 border-t border-pink-200/60">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Select Instagram Account
                          </label>
                          <select
                            value={targetIgAccount}
                            onChange={(e) => setTargetIgAccount(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-pink-200 text-xs text-slate-900 bg-white focus:outline-none"
                          >
                            {accounts.instagram.map((a) => (
                              <option key={a.accountId} value={a.accountId}>
                                @{a.username}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Threads Account Card */}
                    <div
                      onClick={() => setTargetTh(!targetTh)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        targetTh
                          ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <AtSign className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">Threads Post</div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {accounts.threads.length > 0
                                ? `@${accounts.threads.find((a) => a.accountId === targetThAccount)?.username || accounts.threads[0].username}`
                                : 'No account connected'}
                            </div>
                          </div>
                        </div>

                        <input
                          type="checkbox"
                          checked={targetTh}
                          onChange={(e) => {
                            e.stopPropagation();
                            setTargetTh(e.target.checked);
                          }}
                          className="w-4 h-4 rounded text-slate-900 focus:ring-slate-700 mt-1 cursor-pointer"
                        />
                      </div>

                      {targetTh && accounts.threads.length > 1 && (
                        <div onClick={(e) => e.stopPropagation()} className="pt-2 border-t border-slate-200">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Select Threads Account
                          </label>
                          <select
                            value={targetThAccount}
                            onChange={(e) => setTargetThAccount(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none"
                          >
                            {accounts.threads.map((a) => (
                              <option key={a.accountId} value={a.accountId}>
                                @{a.username}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Facebook Page Card */}
                    <div
                      onClick={() => setTargetFb(!targetFb)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        targetFb
                          ? 'bg-blue-50/60 border-blue-400 ring-2 ring-blue-400/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Facebook className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">Facebook Page</div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {accounts.facebook.length > 0
                                ? accounts.facebook.find((a) => a.accountId === targetFbPage)?.pageName || accounts.facebook[0].pageName
                                : 'No account connected'}
                            </div>
                          </div>
                        </div>

                        <input
                          type="checkbox"
                          checked={targetFb}
                          onChange={(e) => {
                            e.stopPropagation();
                            setTargetFb(e.target.checked);
                          }}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 mt-1 cursor-pointer"
                        />
                      </div>

                      {targetFb && accounts.facebook.length > 1 && (
                        <div onClick={(e) => e.stopPropagation()} className="pt-2 border-t border-blue-200/60">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Select Facebook Page
                          </label>
                          <select
                            value={targetFbPage}
                            onChange={(e) => setTargetFbPage(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-blue-200 text-xs text-slate-900 bg-white focus:outline-none"
                          >
                            {accounts.facebook.map((a) => (
                              <option key={a.accountId} value={a.accountId}>
                                {a.pageName}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: CAPTION MANAGEMENT */}
              {currentStep === 3 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>Manage Captions &amp; Copy</span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      Decide whether to use the same unified caption template across all channels, or customize individually per channel.
                    </p>
                  </div>

                  {/* Mode Toggle Pills */}
                  <div className="p-1 bg-slate-100 rounded-xl flex items-center gap-1 w-full max-w-md">
                    <button
                      type="button"
                      onClick={() => setCaptionMode('unified')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center ${
                        captionMode === 'unified'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Same Caption for All
                    </button>
                    <button
                      type="button"
                      onClick={() => setCaptionMode('individual')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center ${
                        captionMode === 'individual'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Customize Per Channel
                    </button>
                  </div>

                  {/* MODE A: UNIFIED CAPTIONS */}
                  {captionMode === 'unified' ? (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-700">
                            Unified Caption Template
                          </label>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Tags: {'{{title}}'}, {'{{hashtags}}'}
                          </span>
                        </div>
                        <textarea
                          rows={3}
                          value={captionTemplate}
                          onChange={(e) => setCaptionTemplate(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                          placeholder="{{title}}\n\nFollow for more curated cinema moments.\n\n{{hashtags}}"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Hashtags (Comma Separated)
                        </label>
                        <input
                          type="text"
                          value={hashtagsStr}
                          onChange={(e) => setHashtagsStr(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  ) : (
                    /* MODE B: INDIVIDUAL CHANNELS */
                    <div className="space-y-4">
                      {/* Sub-Tabs for each selected channel */}
                      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
                        {selectedChannelsList.map((ch) => {
                          const isTabActive = activeCaptionTab === ch;
                          const label =
                            ch === 'youtube'
                              ? 'YouTube Shorts'
                              : ch === 'instagram'
                              ? 'Instagram Reels'
                              : ch === 'facebook'
                              ? 'Facebook Page'
                              : 'Threads Post';

                          return (
                            <button
                              key={ch}
                              type="button"
                              onClick={() => setActiveCaptionTab(ch)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                isTabActive
                                  ? 'bg-slate-900 text-white shadow-sm'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {ch === 'youtube' && <Youtube className="w-3.5 h-3.5 text-red-500" />}
                              {ch === 'instagram' && <Instagram className="w-3.5 h-3.5 text-pink-500" />}
                              {ch === 'facebook' && <Facebook className="w-3.5 h-3.5 text-blue-500" />}
                              {ch === 'threads' && <AtSign className="w-3.5 h-3.5 text-slate-400" />}
                              <span>{label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Active Tab Textarea */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800">
                            Custom Caption for {activeCaptionTab.toUpperCase()}
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomCaptions((prev) => ({
                                ...prev,
                                [activeCaptionTab]: captionTemplate,
                              }));
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy Unified Template</span>
                          </button>
                        </div>

                        <textarea
                          rows={4}
                          value={customCaptions[activeCaptionTab]}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomCaptions((prev) => ({
                              ...prev,
                              [activeCaptionTab]: val,
                            }));
                          }}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                          placeholder="Write channel-specific caption with {{title}} and {{hashtags}}..."
                        />
                        <p className="text-[11px] text-slate-400">
                          Use {'{{title}}'} and {'{{hashtags}}'} to automatically insert each video's title and tags.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Movie Vault CTA Toggle */}
                  <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-amber-900">
                          Auto-Append Movie Vault #VAULT CTA
                        </div>
                        <div className="text-[11px] text-amber-700">
                          Automatically appends the 1000s of hours Movie Vault call-to-action as first comment / follow-up.
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={enableVaultCta}
                      onChange={(e) => setEnableVaultCta(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: THUMBNAIL MANAGEMENT */}
              {currentStep === 4 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-blue-600" />
                      <span>Manage Thumbnail &amp; Cover Frames</span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      Extract high-res frame captures from your video. Set the same frame for all channels, or fine-tune individually per channel.
                    </p>
                  </div>

                  {/* Mode Toggle Pills */}
                  <div className="p-1 bg-slate-100 rounded-xl flex items-center gap-1 w-full max-w-md">
                    <button
                      type="button"
                      onClick={() => setThumbnailMode('unified')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center ${
                        thumbnailMode === 'unified'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Same Thumbnail for All
                    </button>
                    <button
                      type="button"
                      onClick={() => setThumbnailMode('individual')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center ${
                        thumbnailMode === 'individual'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Customize Per Channel
                    </button>
                  </div>

                  {/* MODE A: UNIFIED THUMBNAIL */}
                  {thumbnailMode === 'unified' ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          Extraction Timestamp (Seconds into video)
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={thumbTimestamp}
                            onChange={(e) => setThumbTimestamp(parseFloat(e.target.value) || 1.0)}
                            className="w-28 px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-bold"
                          />
                          <div className="flex items-center gap-1.5">
                            {[0.5, 1.0, 1.5, 2.0, 3.0].map((sec) => (
                              <button
                                key={sec}
                                type="button"
                                onClick={() => setThumbTimestamp(sec)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                  thumbTimestamp === sec
                                    ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {sec}s
                              </button>
                            ))}
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          The FFmpeg engine extracts a crisp frame capture at this exact timestamp from every video.
                        </p>
                      </div>

                      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1">
                        <div className="font-bold text-slate-800">Drive Companion Thumbnail Support</div>
                        <div className="text-[11px] text-slate-500">
                          If an image with the same base name (e.g., &ldquo;video1.jpg&rdquo; alongside &ldquo;video1.mp4&rdquo;) exists in the Drive folder, it will automatically take priority as the custom cover.
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* MODE B: INDIVIDUAL THUMBNAILS */
                    <div className="space-y-4">
                      {/* Sub-Tabs for each selected channel */}
                      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
                        {selectedChannelsList.map((ch) => {
                          const isTabActive = activeThumbTab === ch;
                          const label =
                            ch === 'youtube'
                              ? 'YouTube Shorts'
                              : ch === 'instagram'
                              ? 'Instagram Reels'
                              : ch === 'facebook'
                              ? 'Facebook Page'
                              : 'Threads Post';

                          return (
                            <button
                              key={ch}
                              type="button"
                              onClick={() => setActiveThumbTab(ch)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                isTabActive
                                  ? 'bg-slate-900 text-white shadow-sm'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {ch === 'youtube' && <Youtube className="w-3.5 h-3.5 text-red-500" />}
                              {ch === 'instagram' && <Instagram className="w-3.5 h-3.5 text-pink-500" />}
                              {ch === 'facebook' && <Facebook className="w-3.5 h-3.5 text-blue-500" />}
                              {ch === 'threads' && <AtSign className="w-3.5 h-3.5 text-slate-400" />}
                              <span>{label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Active Tab Settings */}
                      <div className="space-y-3">
                        <label className="block text-xs font-bold text-slate-800">
                          Cover Frame Timestamp for {activeThumbTab.toUpperCase()}
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={channelThumbnails[activeThumbTab].frameTimestampSeconds}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 1.0;
                              setChannelThumbnails((prev) => ({
                                ...prev,
                                [activeThumbTab]: { frameTimestampSeconds: val },
                              }));
                            }}
                            className="w-28 px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-bold"
                          />
                          <div className="flex items-center gap-1.5">
                            {[0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map((sec) => (
                              <button
                                key={sec}
                                type="button"
                                onClick={() => {
                                  setChannelThumbnails((prev) => ({
                                    ...prev,
                                    [activeThumbTab]: { frameTimestampSeconds: sec },
                                  }));
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                  channelThumbnails[activeThumbTab].frameTimestampSeconds === sec
                                    ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {sec}s
                              </button>
                            ))}
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Tailor exact cover frame timestamps per platform (e.g. 1.5s for YouTube Shorts cover, 0.5s for Instagram Reels).
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 5: SCHEDULING & REVIEW */}
              {currentStep === 5 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span>Scheduling &amp; Dispatch Rules</span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      Configure when and how often videos from your Drive folder should be automatically syndicated.
                    </p>
                  </div>

                  {/* Schedule Mode Selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setScheduleMode('golden_slots')}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        scheduleMode === 'golden_slots'
                          ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-400/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Clock className="w-4 h-4 text-amber-600" />
                        {scheduleMode === 'golden_slots' && <Check className="w-3.5 h-3.5 text-amber-600 stroke-[3]" />}
                      </div>
                      <div className="text-xs font-bold text-slate-900">5 Golden Slots</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        9 AM, 2 PM, 9 PM, 11 PM, 1 AM (±10m jitter)
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setScheduleMode('interval')}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        scheduleMode === 'interval'
                          ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-400/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Sliders className="w-4 h-4 text-blue-600" />
                        {scheduleMode === 'interval' && <Check className="w-3.5 h-3.5 text-blue-600 stroke-[3]" />}
                      </div>
                      <div className="text-xs font-bold text-slate-900">Interval Mode</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Every {intervalHours} hours continuously
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setScheduleMode('manual')}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        scheduleMode === 'manual'
                          ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Play className="w-4 h-4 text-slate-600" />
                        {scheduleMode === 'manual' && <Check className="w-3.5 h-3.5 text-slate-700 stroke-[3]" />}
                      </div>
                      <div className="text-xs font-bold text-slate-900">Manual Trigger</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Post only when triggered via button or API
                      </div>
                    </button>
                  </div>

                  {/* Interval selector if interval mode */}
                  {scheduleMode === 'interval' && (
                    <div className="space-y-1.5 p-3.5 bg-blue-50/50 rounded-2xl border border-blue-200">
                      <label className="block text-xs font-semibold text-slate-700">
                        Post Frequency (Hours between posts)
                      </label>
                      <div className="flex items-center gap-2">
                        {[2, 3, 4, 6, 8, 12].map((hrs) => (
                          <button
                            key={hrs}
                            type="button"
                            onClick={() => setIntervalHours(hrs)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                              intervalHours === hrs
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            Every {hrs}h
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Daily Limit Slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700">
                        Maximum Videos Posted Per Day
                      </label>
                      <span className="text-xs font-bold text-blue-700 font-mono bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        {dailyLimit} videos/day
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(parseInt(e.target.value, 10))}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>

                  {/* Complete Pipeline Summary Card */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Pipeline Configuration Summary
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400">Name:</span>{' '}
                        <span className="font-bold text-slate-800">{formName || 'Untitled'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Drive Folder:</span>{' '}
                        <span className="font-bold text-blue-700">{formFolder}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Channels ({selectedChannelsCount}):</span>{' '}
                        <span className="font-bold text-slate-800">
                          {selectedChannelsList.map((c) => c.toUpperCase()).join(', ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Captions:</span>{' '}
                        <span className="font-bold text-slate-800">
                          {captionMode === 'individual' ? 'Per-Channel Custom' : 'Unified Template'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Thumbnails:</span>{' '}
                        <span className="font-bold text-slate-800">
                          {thumbnailMode === 'individual' ? 'Per-Channel Frames' : `${thumbTimestamp}s Frame`}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Schedule:</span>{' '}
                        <span className="font-bold text-amber-700">
                          {scheduleMode === 'golden_slots'
                            ? '5 Golden Slots'
                            : scheduleMode === 'interval'
                            ? `Every ${intervalHours}h`
                            : 'Manual'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                )}

                {currentStep < 5 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] cursor-pointer"
                  >
                    <span>
                      {currentStep === 1
                        ? 'Next: Select Channels'
                        : currentStep === 2
                        ? 'Next: Captions'
                        : currentStep === 3
                        ? 'Next: Thumbnails'
                        : 'Next: Schedule'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleCreatePipeline}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Activating Pipeline...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Launch Auto-Pilot Pipeline</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notice Modal */}
      <NoticeModal
        isOpen={notice.isOpen}
        title={notice.title}
        message={notice.message}
        type={notice.type}
        onClose={() => setNotice({ ...notice, isOpen: false })}
      />
    </div>
  );
}
