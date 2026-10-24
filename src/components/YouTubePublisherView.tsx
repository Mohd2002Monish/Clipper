'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Youtube,
  Folder,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Clock,
  Trash2,
  Plus,
  RefreshCw,
  Play,
  Tv,
  Smartphone,
  Sparkles,
  Share2,
  Globe,
  Lock,
  EyeOff,
  Check,
  X,
  Layers,
  ArrowRight,
  Zap,
  Calendar,
  Pause,
  Eye,
  ThumbsUp,
  MessageSquare,
  TrendingUp,
  BarChart3,
  Cpu,
} from 'lucide-react';
import { CustomSelect } from './ui/CustomSelect';
import { NoticeModal } from './ui/NoticeModal';
import { YouTubeUploadedVideosView } from './YouTubeUploadedVideosView';

interface CampaignItem {
  _id: string;
  name: string;
  channelId: string;
  channelTitle: string;
  folderName: string;
  status: 'active' | 'paused' | 'completed';
  dailyLimit: number;
  uploadedTodayCount: number;
  lastUploadDate?: string;
  lastUploadAt?: string;
  nextScheduledSlot?: string;
  scheduleHours: number[];
  totalUploaded: number;
  privacyStatus: 'public' | 'unlisted' | 'private';
  videoType: 'short' | 'long_form';
  lastAnalyticsSyncAt?: string;
  lastAiOptimizationAt?: string;
  aiScheduleRationale?: string;
  aiPerformanceSummary?: string;
  createdAt: string;
}

interface YouTubeAccountItem {
  _id: string;
  channelId: string;
  channelTitle: string;
  channelDescription?: string;
  channelCustomUrl?: string;
  channelAvatarUrl?: string;
  subscriberCount?: number;
  isActive: boolean;
  createdAt?: string;
}

interface VideoFileItem {
  id: string;
  name: string;
  title: string;
  duration: number;
  width?: number;
  height?: number;
  aspectRatio: string;
  isShort: boolean;
  sourceType: 'drive' | 'local';
  driveFileId?: string;
  driveLink?: string;
  localPath?: string;
  sizeBytes?: number;
  jobId?: string;
  partIndex?: number;
  folderName: string;
  createdAt: string;
}

interface YouTubeUploadItem {
  _id: string;
  channelId: string;
  channelTitle: string;
  folderName: string;
  title: string;
  description: string;
  privacyStatus: 'public' | 'unlisted' | 'private';
  videoType: 'short' | 'long_form';
  status: 'uploading' | 'completed' | 'failed';
  videoId?: string;
  youtubeUrl?: string;
  error?: string;
  publishedAt?: string;
  views?: number;
  likes?: number;
  comments?: number;
  createdAt?: string;
}

interface FolderOption {
  _id: string;
  name: string;
  slug: string;
  jobCount?: number;
}

export function YouTubePublisherView() {
  // Accounts state
  const [accounts, setAccounts] = useState<YouTubeAccountItem[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isConnectingAccount, setIsConnectingAccount] = useState(false);

  // Folders state
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('General');
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  // View mode tab state
  const [viewMode, setViewMode] = useState<'dispatcher' | 'uploaded-videos'>('dispatcher');

  // Videos in folder state
  const [videos, setVideos] = useState<VideoFileItem[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);

  // Selected video for upload
  const [selectedVideo, setSelectedVideo] = useState<VideoFileItem | null>(null);

  // Upload Form state
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadTags, setUploadTags] = useState('Shorts, Video, Splitter');
  const [uploadPrivacy, setUploadPrivacy] = useState<'public' | 'unlisted' | 'private'>('public');
  const [uploadVideoType, setUploadVideoType] = useState<'short' | 'long_form'>('short');
  const [isMadeForKids, setIsMadeForKids] = useState(false);

  // Uploading status
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState<string | null>(null);
  const [uploadSuccessUrl, setUploadSuccessUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<YouTubeUploadItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Campaign Automation State (8 Videos / Day Auto-Pilot)
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [campaignFolder, setCampaignFolder] = useState('Mr. Robot');
  const [campaignChannelId, setCampaignChannelId] = useState('');
  const [campaignPrivacy, setCampaignPrivacy] = useState<'public' | 'unlisted' | 'private'>('public');
  const [isSubmittingCampaign, setIsSubmittingCampaign] = useState(false);

  // Campaign Feedback & Action State
  const [campaignActionMsg, setCampaignActionMsg] = useState<string | null>(null);
  const [isTriggeringUpload, setIsTriggeringUpload] = useState(false);
  const [isSyncingAnalytics, setIsSyncingAnalytics] = useState(false);
  const [isOptimizingSchedule, setIsOptimizingSchedule] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  // Notice Modal state replacing alert() and confirm()
  const [modalNotice, setModalNotice] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    message: '',
  });

  const showNotice = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', title?: string) => {
    setModalNotice({ isOpen: true, message, type, title, confirmText: 'OK' });
  };

  const confirmNotice = (message: string, onConfirm: () => void, title: string = 'Confirm Action') => {
    setModalNotice({
      isOpen: true,
      message,
      type: 'warning',
      title,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      onConfirm,
    });
  };

  // Feedback states
  const [oauthSuccess, setOauthSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('youtubeError') || params.get('driveError');
      if (err) {
        showNotice(decodeURIComponent(err), 'error', 'Google API Notice');
        const url = new URL(window.location.href);
        url.searchParams.delete('youtubeError');
        url.searchParams.delete('driveError');
        window.history.replaceState({}, '', url.toString());
      }
      const ytStatus = params.get('youtube');
      const channel = params.get('channel');
      if (ytStatus === 'connected') {
        setOauthSuccess(
          channel
            ? `Connected: "${decodeURIComponent(channel)}"`
            : 'Channel connected!'
        );
        const url = new URL(window.location.href);
        url.searchParams.delete('youtube');
        url.searchParams.delete('channel');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, []);

  // 1. Fetch Accounts
  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoadingAccounts(true);
      const res = await fetch('/api/youtube/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
        if (data.accounts?.length > 0 && !selectedChannelId) {
          const active = data.accounts.find((a: YouTubeAccountItem) => a.isActive) || data.accounts[0];
          setSelectedChannelId(active.channelId);
        }
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [selectedChannelId]);

  // 2. Fetch Folders
  const fetchFolders = useCallback(async () => {
    try {
      setIsLoadingFolders(true);
      const res = await fetch('/api/folders');
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingFolders(false);
    }
  }, []);

  // 3. Fetch Videos in Selected Folder
  const fetchVideos = useCallback(async (folderName: string) => {
    try {
      setIsLoadingVideos(true);
      const res = await fetch(`/api/youtube/videos?folder=${encodeURIComponent(folderName)}`);
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingVideos(false);
    }
  }, []);

  // 4. Fetch Upload History
  const fetchHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const res = await fetch('/api/youtube/history?limit=25');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // 5. Fetch Campaigns
  const fetchCampaigns = useCallback(async () => {
    try {
      setIsLoadingCampaigns(true);
      const res = await fetch('/api/youtube/campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingCampaigns(false);
    }
  }, []);

  // 6. Fetch Campaign Analytics
  const fetchCampaignAnalytics = useCallback(async (campaignId?: string) => {
    try {
      const url = campaignId
        ? `/api/youtube/campaigns/analytics?campaignId=${encodeURIComponent(campaignId)}`
        : '/api/youtube/campaigns/analytics';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Handle Create Campaign
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetChannel = campaignChannelId || selectedChannelId || (accounts[0] ? accounts[0].channelId : '');
    if (!targetChannel) {
      showNotice('Please connect and select a YouTube channel first.', 'warning');
      return;
    }

    try {
      setIsSubmittingCampaign(true);
      const res = await fetch('/api/youtube/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName.trim() || undefined,
          channelId: targetChannel,
          folderName: campaignFolder || selectedFolder || 'Mr. Robot',
          privacyStatus: campaignPrivacy,
          videoType: 'short',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create campaign');

      setCampaignActionMsg(data.message || 'Auto-pilot campaign launched (8 videos/day)!');
      setShowCampaignModal(false);
      fetchCampaigns();
      fetchCampaignAnalytics();
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : 'Error creating campaign', 'error');
    } finally {
      setIsSubmittingCampaign(false);
    }
  };

  // Trigger Immediate Upload
  const handleTriggerUpload = async () => {
    try {
      setIsTriggeringUpload(true);
      setCampaignActionMsg('Triggering immediate upload cycle from Drive folder...');
      const res = await fetch('/api/youtube/campaigns/trigger', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setCampaignActionMsg(data.message || 'Upload cycle completed!');
        fetchCampaigns();
        fetchHistory();
        fetchCampaignAnalytics();
      } else {
        showNotice(data.error || 'Failed to trigger upload', 'error');
      }
    } catch {
      showNotice('Error triggering upload cycle', 'error');
    } finally {
      setIsTriggeringUpload(false);
    }
  };

  // Sync Analytics Now
  const handleSyncAnalytics = async (campaignId?: string) => {
    try {
      setIsSyncingAnalytics(true);
      setCampaignActionMsg('Querying YouTube API for latest views, likes & comments...');
      const res = await fetch('/api/youtube/campaigns/sync-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      });
      const data = await res.json();
      if (res.ok) {
        setCampaignActionMsg(data.message || 'Analytics synchronized!');
        fetchCampaignAnalytics(campaignId);
        fetchCampaigns();
      }
    } catch {
      showNotice('Error syncing analytics', 'error');
    } finally {
      setIsSyncingAnalytics(false);
    }
  };

  // Re-run Gemini AI Schedule Optimizer
  const handleOptimizeSchedule = async (campaignId: string) => {
    try {
      setIsOptimizingSchedule(true);
      setCampaignActionMsg('Analyzing audience retention & generating 8-slot schedule with Google Gemini AI...');
      const res = await fetch('/api/youtube/campaigns/optimize-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      });
      const data = await res.json();
      if (res.ok) {
        setCampaignActionMsg('Weekly schedule optimized by Gemini AI!');
        fetchCampaigns();
      } else {
        showNotice(data.error || 'Failed to optimize schedule', 'error');
      }
    } catch {
      showNotice('Error optimizing schedule with AI', 'error');
    } finally {
      setIsOptimizingSchedule(false);
    }
  };

  // Toggle Campaign Status
  const handleToggleCampaignStatus = async (campaignId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch('/api/youtube/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, status: nextStatus }),
      });
      if (res.ok) {
        fetchCampaigns();
      }
    } catch {
      showNotice('Failed to update campaign status', 'error');
    }
  };

  // Delete Campaign
  const handleDeleteCampaign = async (campaignId: string) => {
    confirmNotice('Are you sure you want to delete this auto-pilot campaign?', async () => {
      try {
        const res = await fetch(`/api/youtube/campaigns?campaignId=${encodeURIComponent(campaignId)}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          fetchCampaigns();
        }
      } catch {
        showNotice('Failed to delete campaign', 'error');
      }
    }, 'Delete Campaign');
  };

  useEffect(() => {
    fetchAccounts();
    fetchFolders();
    fetchHistory();
    fetchCampaigns();
    fetchCampaignAnalytics();
  }, [fetchAccounts, fetchFolders, fetchHistory, fetchCampaigns, fetchCampaignAnalytics]);

  useEffect(() => {
    if (selectedFolder) {
      fetchVideos(selectedFolder);
    }
  }, [selectedFolder, fetchVideos]);

  // Handle Connect New Account
  const handleConnectAccount = async () => {
    try {
      setIsConnectingAccount(true);
      const res = await fetch('/api/youtube/auth');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        showNotice(data.error || 'Failed to start YouTube authentication.', 'error');
      }
    } catch (err) {
      showNotice('Network error connecting YouTube account.', 'error');
    } finally {
      setIsConnectingAccount(false);
    }
  };

  // Handle Delete Account
  const handleDeleteAccount = async (channelId: string) => {
    confirmNotice('Are you sure you want to disconnect this YouTube account?', async () => {
      try {
        const res = await fetch(`/api/youtube/accounts?channelId=${encodeURIComponent(channelId)}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          await fetchAccounts();
          if (selectedChannelId === channelId) {
            setSelectedChannelId('');
          }
        }
      } catch {
        showNotice('Failed to disconnect account.', 'error');
      }
    }, 'Disconnect Channel');
  };

  // Handle Select Video for Upload
  const handleSelectVideo = (video: VideoFileItem) => {
    setSelectedVideo(video);
    setUploadSuccessUrl(null);
    setUploadError(null);

    const isShort = video.isShort || video.aspectRatio === '9:16' || video.duration <= 60;
    setUploadVideoType(isShort ? 'short' : 'long_form');

    const cleanTitle = video.title || video.name.replace(/\.[^/.]+$/, '');
    setUploadTitle(isShort ? `${cleanTitle} #Shorts` : cleanTitle);

    setUploadDescription(
      isShort
        ? `Part of our series. Split & formatted with VideoTimmer.\n\n#Shorts #Viral #Video`
        : `Original full video rendered and published with VideoTimmer.\n\nEnjoy and subscribe for more!`
    );

    setUploadTags(isShort ? 'Shorts, YouTubeShorts, Viral, Video' : 'Video, Longform, Original');
  };

  // Handle Video Type change
  const handleVideoTypeToggle = (type: 'short' | 'long_form') => {
    setUploadVideoType(type);
    if (type === 'short' && !uploadTitle.includes('#Shorts')) {
      setUploadTitle((prev) => `${prev.trim()} #Shorts`);
    } else if (type === 'long_form') {
      setUploadTitle((prev) => prev.replace(/#Shorts/gi, '').trim());
    }
  };

  // Handle Submit Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVideo) return;
    if (!selectedChannelId) {
      setUploadError('Please select a YouTube channel first.');
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError('Video title is required.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadProgressMsg('Initializing upload stream to YouTube API...');

      const payload = {
        channelId: selectedChannelId,
        folderName: selectedFolder,
        sourceType: selectedVideo.sourceType,
        localPath: selectedVideo.localPath,
        driveFileId: selectedVideo.driveFileId,
        title: uploadTitle,
        description: uploadDescription,
        tags: uploadTags.split(',').map((t) => t.trim()).filter(Boolean),
        privacyStatus: uploadPrivacy,
        videoType: uploadVideoType,
        isMadeForKids,
        jobId: selectedVideo.jobId,
        partIndex: selectedVideo.partIndex,
        partFilename: selectedVideo.name,
      };

      setUploadProgressMsg('Streaming video from source to YouTube...');

      const res = await fetch('/api/youtube/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload video to YouTube.');
      }

      setUploadSuccessUrl(data.upload?.youtubeUrl || `https://youtu.be/${data.upload?.videoId}`);
      setUploadProgressMsg('Video published successfully!');
      fetchHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = Math.floor(sec % 60);
    return `${mins}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto w-full">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold tracking-wide border border-white/20">
              <Youtube className="w-3.5 h-3.5 text-white" />
              <span>Multi-Account YouTube Studio</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              YouTube Drive & Shorts Dispatcher
            </h1>
            <p className="text-sm md:text-base text-rose-100 max-w-2xl">
              Publish rendered video parts and Google Drive folders directly to multiple YouTube channels. Full automated support for 9:16 Shorts and 16:9 Long-form content.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => {
                if (selectedFolder && selectedFolder !== 'all') {
                  setCampaignFolder(selectedFolder);
                }
                setShowCampaignModal(true);
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black px-5 py-3 rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] text-sm"
            >
              <Zap className="w-4 h-4 text-slate-950" />
              <span>+ Start Auto-Pilot (8/Day)</span>
            </button>

            <button
              onClick={handleConnectAccount}
              disabled={isConnectingAccount}
              className="flex items-center gap-2 bg-white text-rose-600 hover:bg-rose-50 font-bold px-5 py-3 rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{isConnectingAccount ? 'Redirecting...' : '+ Connect Channel'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* OAuth Success Banner */}
      {oauthSuccess && (
        <div className="rounded-2xl border border-emerald-500 bg-emerald-50 p-5 shadow-sm flex items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500 text-white shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-950">YouTube Channel Linked!</h4>
              <p className="text-xs text-emerald-800">{oauthSuccess}</p>
            </div>
          </div>
          <button
            onClick={() => setOauthSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
        <button
          type="button"
          onClick={() => setViewMode('dispatcher')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            viewMode === 'dispatcher'
              ? 'bg-red-600 text-white shadow-md shadow-red-500/20'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Youtube className="w-4 h-4" />
          <span>Auto-Pilot & Publisher</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('uploaded-videos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            viewMode === 'uploaded-videos'
              ? 'bg-red-600 text-white shadow-md shadow-red-500/20'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Uploaded Videos & Views</span>
        </button>
      </div>

      {viewMode === 'uploaded-videos' ? (
        <YouTubeUploadedVideosView />
      ) : (
        <>
          {/* Section 1: Connected YouTube Accounts Manager */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-50 text-red-600">
              <Youtube className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Connected Channels</h2>
            </div>
          </div>
          <button
            onClick={fetchAccounts}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Refresh accounts"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingAccounts ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center bg-slate-50/50 space-y-3">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Youtube className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800">No YouTube Accounts Connected</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Connect your YouTube channel using Google OAuth. You can connect and switch between multiple brand channels.
              </p>
            </div>
            <button
              onClick={handleConnectAccount}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Connect Channel Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {accounts.map((acc) => {
              const isSelected = selectedChannelId === acc.channelId;
              return (
                <div
                  key={acc.channelId}
                  onClick={() => setSelectedChannelId(acc.channelId)}
                  className={`cursor-pointer rounded-xl p-4 border transition-all flex items-start justify-between gap-3 relative ${
                    isSelected
                      ? 'border-red-500 bg-red-50/40 ring-2 ring-red-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {acc.channelAvatarUrl ? (
                      <img
                        src={acc.channelAvatarUrl}
                        alt={acc.channelTitle}
                        className="w-10 h-10 rounded-full border border-slate-200 shrink-0 object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm shrink-0">
                        {acc.channelTitle.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 text-xs truncate">
                          {acc.channelTitle}
                        </span>
                        {isSelected && (
                          <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-red-500 text-white">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {acc.channelCustomUrl || 'Channel ID: ' + acc.channelId.substring(0, 10) + '...'}
                      </div>
                      {typeof acc.subscriberCount === 'number' && (
                        <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                          {acc.subscriberCount.toLocaleString()} subscribers
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteAccount(acc.channelId);
                    }}
                    className="text-slate-300 hover:text-red-500 p-1 rounded transition-colors"
                    title="Disconnect this channel"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Campaign Feedback Alert */}
      {campaignActionMsg && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm flex items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500 text-amber-950 font-bold shrink-0">
              <Zap className="w-4 h-4 text-amber-950" />
            </div>
            <p className="text-xs font-semibold text-amber-950">{campaignActionMsg}</p>
          </div>
          <button
            onClick={() => setCampaignActionMsg(null)}
            className="text-amber-700 hover:text-amber-900 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section 1.5: Auto-Pilot Publishing Campaigns & AI Scheduling (8 Videos Daily) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                <Zap className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-800">
                    Auto-Pilot Publishing Campaigns
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                    8 Videos / Day Limit
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Uploads 1 video every hour from your selected Drive folder. Syncs views & likes daily. Gemini AI optimizes the 8 best slots every week.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (selectedFolder && selectedFolder !== 'all') {
                  setCampaignFolder(selectedFolder);
                }
                setShowCampaignModal(true);
              }}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition-all hover:scale-[1.02]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Create Auto-Pilot Campaign</span>
            </button>
          </div>
        </div>

        {campaigns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
              <Zap className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800">No Auto-Pilot Campaigns Active</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Launch a continuous campaign from any Google Drive folder (like "Mr. Robot"). The engine will publish 8 videos daily, retrieve analytics every day, and use Gemini AI to update your publishing hours each week.
              </p>
            </div>
            <button
              onClick={() => {
                if (selectedFolder && selectedFolder !== 'all') {
                  setCampaignFolder(selectedFolder);
                }
                setShowCampaignModal(true);
              }}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl shadow-md transition-all hover:scale-[1.02]"
            >
              <Zap className="w-4 h-4 text-slate-950" />
              <span>Configure Auto-Pilot Campaign (8 Videos/Day)</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {campaigns.map((camp) => {
              const isActive = camp.status === 'active';
              const progressPct = Math.min(
                100,
                Math.round((camp.uploadedTodayCount / (camp.dailyLimit || 8)) * 100)
              );

              return (
                <div
                  key={camp._id}
                  className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/40 to-amber-50/20 p-5 md:p-6 shadow-sm space-y-5"
                >
                  {/* Campaign Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-amber-500 text-amber-950 font-bold shrink-0">
                        <Zap className="w-5 h-5 text-amber-950" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-black text-slate-900">{camp.name}</h3>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-100 text-amber-700 border border-amber-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                              }`}
                            />
                            {isActive ? 'Active (Uploading Hourly)' : 'Paused'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 font-semibold text-slate-700">
                            <Folder className="w-3.5 h-3.5 text-blue-500" />
                            Drive Folder: <strong className="text-blue-600">{camp.folderName}</strong>
                          </span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <Youtube className="w-3.5 h-3.5 text-red-500" />
                            Channel: <strong>{camp.channelTitle}</strong>
                          </span>
                          <span>&bull;</span>
                          <span className="capitalize">{camp.privacyStatus}</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Badge */}
                    <div className="flex items-center gap-2 text-right">
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Daily Uploads
                        </div>
                        <div className="text-sm font-black text-slate-900">
                          {camp.uploadedTodayCount} / {camp.dailyLimit} videos
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Daily Progress Bar */}
                  <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-600">Daily Cap Progress (8 Videos Limit):</span>
                      <span className="font-mono text-slate-900">
                        {camp.uploadedTodayCount >= camp.dailyLimit
                          ? 'Daily 8/8 limit completed for today'
                          : `${camp.dailyLimit - camp.uploadedTodayCount} remaining today`}
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                      <span>Total Lifetime Uploaded: {camp.totalUploaded} videos</span>
                      <span>Next Slot: {camp.nextScheduledSlot || 'Hourly Cron'}</span>
                    </div>
                  </div>

                  {/* 8-Slot Schedule Ribbon */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                        8 Daily Publishing Slots:
                      </span>
                      <span className="text-[11px] text-slate-400">
                        AI-optimized for peak retention
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(camp.scheduleHours || [9, 11, 13, 15, 17, 19, 21, 23]).map((hour) => (
                        <div
                          key={hour}
                          className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800 shadow-sm flex items-center gap-1"
                        >
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{hour.toString().padStart(2, '0')}:00</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Gemini AI Weekly Strategy Box */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span>Google Gemini AI Weekly Strategy & Audience Retention</span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                        Updated Weekly
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">
                      {camp.aiPerformanceSummary || 'Audience view patterns and peak traffic hours are monitored daily.'}
                    </p>
                    {camp.aiScheduleRationale && (
                      <p className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-lg border border-indigo-100 font-mono leading-relaxed">
                        Strategy Rationale: {camp.aiScheduleRationale}
                      </p>
                    )}
                  </div>

                  {/* Daily Performance Metrics Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Eye className="w-3 h-3 text-blue-500" /> Total Views
                      </div>
                      <div className="text-base font-black text-slate-900">
                        {analyticsData?.totalViews ? analyticsData.totalViews.toLocaleString() : '0'}
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3 text-rose-500" /> Total Likes
                      </div>
                      <div className="text-base font-black text-slate-900">
                        {analyticsData?.totalLikes ? analyticsData.totalLikes.toLocaleString() : '0'}
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-purple-500" /> Comments
                      </div>
                      <div className="text-base font-black text-slate-900">
                        {analyticsData?.totalComments ? analyticsData.totalComments.toLocaleString() : '0'}
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-500" /> Peak Hour
                      </div>
                      <div className="text-base font-black text-emerald-600">
                        {analyticsData?.bestPerformingHour !== undefined
                          ? `${analyticsData.bestPerformingHour}:00`
                          : '18:00'}
                      </div>
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={handleTriggerUpload}
                        disabled={isTriggeringUpload || camp.uploadedTodayCount >= camp.dailyLimit}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTriggeringUpload ? 'animate-spin' : ''}`} />
                        <span>Upload Next Video Now</span>
                      </button>

                      <button
                        onClick={() => handleSyncAnalytics(camp._id)}
                        disabled={isSyncingAnalytics}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
                      >
                        <BarChart3 className={`w-3.5 h-3.5 ${isSyncingAnalytics ? 'animate-spin' : ''}`} />
                        <span>Sync Views & Likes</span>
                      </button>

                      <button
                        onClick={() => handleOptimizeSchedule(camp._id)}
                        disabled={isOptimizingSchedule}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition-colors"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${isOptimizingSchedule ? 'animate-spin' : ''}`} />
                        <span>Re-Optimize Schedule with AI</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleCampaignStatus(camp._id, camp.status)}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title={isActive ? 'Pause campaign' : 'Resume campaign'}
                      >
                        {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={() => handleDeleteCampaign(camp._id)}
                        className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-slate-100 transition-colors"
                        title="Delete campaign"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Campaign Creation Modal */}
      {showCampaignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 md:p-8 shadow-2xl space-y-6 relative border border-slate-200 animate-slideUp">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500 text-amber-950 font-bold">
                  <Zap className="w-5 h-5 text-amber-950" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Launch Auto-Pilot Campaign</h3>
                  <p className="text-xs text-slate-500">
                    Automated hourly publishing capped at strictly 8 videos per day.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCampaignModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Campaign Name:
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. Mr. Robot Series Daily Drops"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target YouTube Channel:
                </label>
                {accounts.length === 0 ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                    No YouTube channels connected. Please connect a channel first.
                  </div>
                ) : (
                  <CustomSelect
                    value={campaignChannelId || selectedChannelId || (accounts[0] ? accounts[0].channelId : '')}
                    onChange={(val) => setCampaignChannelId(val)}
                    options={accounts.map((acc) => ({
                      value: acc.channelId,
                      label: acc.channelTitle,
                      badge: acc.channelCustomUrl || undefined,
                    }))}
                    placeholder="Select Target Channel..."
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Source Google Drive Folder:
                </label>
                <CustomSelect
                  value={campaignFolder}
                  onChange={(val) => setCampaignFolder(val)}
                  options={folders.map((f) => ({
                    value: f.name,
                    label: f.name,
                    badge: f.jobCount ? `${f.jobCount} parts` : undefined,
                  }))}
                  placeholder="Select Drive Folder..."
                />
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Runs hourly &bull; 8 uploads daily &bull; Weekly Gemini AI schedule optimization</span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCampaignModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCampaign || accounts.length === 0}
                  className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 text-slate-950" />
                  <span>{isSubmittingCampaign ? 'Launching...' : 'Launch Auto-Pilot Campaign'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Section 2: Folder Selector & Video Browser */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Folder Videos
                </h2>
                <p className="text-xs text-slate-500">
                  Videos inside configured Drive storage
                </p>
              </div>
            </div>
          </div>

          {/* Folder Selector Dropdown */}
          <div className="flex items-center gap-2.5">
            <div className="w-56">
              <CustomSelect
                value={selectedFolder}
                onChange={(val) => {
                  setSelectedFolder(val);
                  setSelectedVideo(null);
                }}
                size="sm"
                options={[
                  { value: 'all', label: 'All Configured Folders' },
                  ...folders.map((f) => ({
                    value: f.name,
                    label: f.name,
                    badge: f.jobCount ? `${f.jobCount}` : undefined,
                  })),
                ]}
              />
            </div>

            <button
              onClick={() => {
                fetchFolders();
                fetchVideos(selectedFolder);
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Refresh folders and scan Google Drive"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingVideos || isLoadingFolders ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Video Grid */}
        {isLoadingVideos ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
            <p className="text-xs">Scanning Google Drive and storage for videos in "{selectedFolder}"...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50 space-y-3">
            <Tv className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-xs font-semibold text-slate-700">
              No rendered videos found in folder "{selectedFolder}"
            </div>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              If your video is in a specific Google Drive folder or subfolder, try selecting it or scan across all folders.
            </p>
            {selectedFolder !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedFolder('all')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold border border-blue-200 transition-colors"
              >
                <Folder className="w-3.5 h-3.5" />
                <span>Scan All Google Drive Folders</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((vid) => {
              const isSelected = selectedVideo?.id === vid.id;
              const isShort = vid.isShort || vid.aspectRatio === '9:16' || vid.duration <= 60;

              return (
                <div
                  key={vid.id}
                  onClick={() => handleSelectVideo(vid)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all flex flex-col justify-between space-y-3 relative group ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/20 shadow-md'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isShort
                            ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                            : 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20'
                        }`}
                      >
                        {isShort ? (
                          <>
                            <Smartphone className="w-3 h-3" /> YouTube Short
                          </>
                        ) : (
                          <>
                            <Tv className="w-3 h-3" /> Long-Form
                          </>
                        )}
                      </span>

                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatSeconds(vid.duration)}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {vid.title}
                      </h4>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                        {vid.name}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-1">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {vid.aspectRatio}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {vid.sourceType === 'drive' ? 'Google Drive' : 'Local Storage'}
                      </span>
                      {vid.driveLink && (
                        <a
                          href={vid.driveLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-500 hover:underline inline-flex items-center gap-0.5 ml-auto"
                        >
                          Drive <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Folder: <strong className="text-slate-600">{vid.folderName}</strong>
                    </span>
                    <button
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3 h-3" /> Selected
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-3 h-3" /> Select for Upload
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

      {/* Section 3: Upload Publishing Drawer / Form */}
      {selectedVideo && (
        <div className="bg-white rounded-2xl border-2 border-blue-500 shadow-xl p-6 md:p-8 space-y-6 animate-fadeIn">
          <div className="flex items-start justify-between pb-4 border-b border-slate-100">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
                <UploadCloud className="w-4 h-4" />
                <span>Upload to YouTube</span>
              </div>
              <h2 className="text-xl font-black text-slate-900">
                Publishing: {selectedVideo.title}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure YouTube metadata, target channel, and publication options.
              </p>
            </div>
            <button
              onClick={() => setSelectedVideo(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleUploadSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Channel & Format selection */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Target YouTube Channel:
                  </label>
                  {accounts.length === 0 ? (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                      No YouTube accounts connected. Please connect a channel above.
                    </div>
                  ) : (
                    <CustomSelect
                      value={selectedChannelId}
                      onChange={(val) => setSelectedChannelId(val)}
                      options={accounts.map((acc) => ({
                        value: acc.channelId,
                        label: acc.channelTitle,
                        badge: acc.channelCustomUrl || undefined,
                      }))}
                      placeholder="Select YouTube Channel..."
                    />
                  )}
                </div>

                {/* Video Format Selection: Shorts vs Long-Form */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Video Format Mode:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleVideoTypeToggle('short')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                        uploadVideoType === 'short'
                          ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <Smartphone className={`w-4 h-4 shrink-0 mt-0.5 ${uploadVideoType === 'short' ? 'text-rose-600' : 'text-slate-400'}`} />
                      <div>
                        <div className="text-xs font-bold text-slate-800">YouTube Short</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Appends #Shorts. Recommended for vertical (9:16) & under 60s.
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleVideoTypeToggle('long_form')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                        uploadVideoType === 'long_form'
                          ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <Tv className={`w-4 h-4 shrink-0 mt-0.5 ${uploadVideoType === 'long_form' ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <div>
                        <div className="text-xs font-bold text-slate-800">Long-Form Video</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Standard player feed. Best for 16:9 widescreen content.
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Privacy Setting */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Visibility & Privacy:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'public', label: 'Public', icon: Globe },
                      { id: 'unlisted', label: 'Unlisted', icon: EyeOff },
                      { id: 'private', label: 'Private', icon: Lock },
                    ].map((p) => {
                      const Icon = p.icon;
                      const isSelected = uploadPrivacy === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setUploadPrivacy(p.id as any)}
                          className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-sm'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Made for kids checkbox */}
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={isMadeForKids}
                      onChange={(e) => setIsMadeForKids(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Declared as "Made for Kids" (COPPA Compliance)</span>
                  </label>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Video Title (Max 100 characters):
                  </label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    maxLength={100}
                    placeholder="Enter YouTube Video Title..."
                    className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <div className="text-[10px] text-slate-400 mt-1 text-right">
                    {uploadTitle.length}/100
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Description:
                  </label>
                  <textarea
                    rows={4}
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder="Enter description, links, hashtags..."
                    className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs font-medium rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Tags (Comma-separated keywords):
                  </label>
                  <input
                    type="text"
                    value={uploadTags}
                    onChange={(e) => setUploadTags(e.target.value)}
                    placeholder="Shorts, viral, part1, trending"
                    className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Status alerts */}
            {uploadError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadProgressMsg && !uploadSuccessUrl && (
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                <span>{uploadProgressMsg}</span>
              </div>
            )}

            {uploadSuccessUrl && (
              <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Video Successfully Uploaded to YouTube!
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span>Watch live:</span>
                  <a
                    href={uploadSuccessUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-blue-600 underline font-bold inline-flex items-center gap-1"
                  >
                    {uploadSuccessUrl} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedVideo(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading || accounts.length === 0}
                className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-lg transition-all disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Publishing to YouTube...</span>
                  </>
                ) : (
                  <>
                    <Youtube className="w-4 h-4" />
                    <span>Publish Video to YouTube</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Section 4: Upload History */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">YouTube Upload History</h2>
              <p className="text-xs text-slate-500">
                Track all previously published videos across your YouTube channels.
              </p>
            </div>
          </div>
          <button
            onClick={fetchHistory}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Refresh history"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {history.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No videos uploaded yet. Select a video from above to publish to your channel.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="pb-2">Video Title</th>
                  <th className="pb-2">Channel</th>
                  <th className="pb-2">Views</th>
                  <th className="pb-2">Format</th>
                  <th className="pb-2">Visibility</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">YouTube URL</th>
                  <th className="pb-2">Published</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {history.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/50">
                    <td className="py-3 font-semibold text-slate-800 max-w-xs truncate">
                      {item.title}
                    </td>
                    <td className="py-3 text-slate-600">{item.channelTitle}</td>
                    <td className="py-3 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 font-bold bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded text-xs text-rose-700">
                        <Eye className="w-3 h-3 text-rose-600" />
                        <span>{(item.views || 0).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.videoType === 'short'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {item.videoType === 'short' ? 'Short' : 'Long-Form'}
                      </span>
                    </td>
                    <td className="py-3 capitalize text-slate-500">{item.privacyStatus}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : item.status === 'uploading'
                            ? 'bg-blue-100 text-blue-700 animate-pulse'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {item.status === 'completed' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Published
                          </>
                        ) : item.status === 'uploading' ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin text-blue-600" /> Uploading
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3 text-red-600" /> Failed
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3">
                      {item.youtubeUrl ? (
                        <a
                          href={item.youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 font-mono hover:underline inline-flex items-center gap-1"
                        >
                          Watch <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>
                    <td className="py-3 text-slate-400 text-[11px]">
                      {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* Global Notice / Confirmation Modal */}
      <NoticeModal
        isOpen={modalNotice.isOpen}
        onClose={() => setModalNotice((prev) => ({ ...prev, isOpen: false }))}
        title={modalNotice.title}
        message={modalNotice.message}
        type={modalNotice.type}
        confirmText={modalNotice.confirmText}
        cancelText={modalNotice.cancelText}
        onConfirm={modalNotice.onConfirm}
      />
    </div>
  );
}
