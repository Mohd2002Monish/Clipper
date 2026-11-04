'use client';

import React, { useState, useEffect } from 'react';
import {
  Send,
  Calendar,
  Clock,
  Sparkles,
  Youtube,
  Instagram,
  AtSign,
  Facebook,
  CheckCircle2,
  AlertTriangle,
  Film,
  UploadCloud,
  Layers,
  ChevronDown,
  Hash,
  Shuffle,
  Eye,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Zap,
  Scissors,
  X,
} from 'lucide-react';
import { CustomSelect } from './ui/CustomSelect';
import { NoticeModal } from './ui/NoticeModal';
import { MediaAssetItem } from './MediaLibraryView';

interface OmniComposerViewProps {
  initialAsset?: MediaAssetItem | null;
  onOpenMediaLibrary?: () => void;
}

export function OmniComposerView({ initialAsset, onOpenMediaLibrary }: OmniComposerViewProps) {
  // Target Channels
  const [channels, setChannels] = useState({
    youtube: false,
    instagram: true,
    threads: true,
    facebook: true,
  });

  // Media Source
  const [selectedAsset, setSelectedAsset] = useState<MediaAssetItem | null>(initialAsset || null);

  // Content
  const [masterCaption, setMasterCaption] = useState('');
  const [activePlatformTab, setActivePlatformTab] = useState<'threads' | 'instagram' | 'facebook' | 'youtube'>('threads');

  // Platform specific customizations
  const [threadsText, setThreadsText] = useState('');
  const [threadsTopic, setThreadsTopic] = useState('Movies');
  const [instagramCaption, setInstagramCaption] = useState('');
  const [instagramShareGrid, setInstagramShareGrid] = useState(true);
  const [facebookTitle, setFacebookTitle] = useState('');
  const [facebookDescription, setFacebookDescription] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubeTags, setYoutubeTags] = useState('Shorts, Movies, Cinema, Bollywood');

  // Automation / CTA
  const [enableVaultCta, setEnableVaultCta] = useState(true);

  // Scheduling
  const [scheduleMode, setScheduleMode] = useState<'now' | 'golden_slot' | 'custom'>('now');
  const [customDateTime, setCustomDateTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Studio Splits modal state
  const [studioSplits, setStudioSplits] = useState<any[]>([]);
  const [isSplitsModalOpen, setIsSplitsModalOpen] = useState(false);
  const [isLoadingSplits, setIsLoadingSplits] = useState(false);

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

  useEffect(() => {
    if (initialAsset) {
      setSelectedAsset(initialAsset);
      if (!facebookTitle) setFacebookTitle(initialAsset.title);
      if (!youtubeTitle) setYoutubeTitle(initialAsset.title);
    }
  }, [initialAsset]);

  const toggleChannel = (channel: 'youtube' | 'instagram' | 'threads' | 'facebook') => {
    setChannels((prev) => ({ ...prev, [channel]: !prev[channel] }));
  };

  const addTag = (tag: string) => {
    setMasterCaption((prev) => (prev ? `${prev} ${tag}` : tag));
  };

  const fetchStudioSplits = async () => {
    setIsLoadingSplits(true);
    try {
      const res = await fetch('/api/media/library?sourceType=rendered_split');
      let data: any;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(
          res.status >= 500
            ? `Server processing error (${res.status}). The Omni-Post operation timed out or failed on the server.`
            : `Server returned non-JSON response (${res.status}): ${text.slice(0, 100)}`
        );
      }
      if (data.success) {
        setStudioSplits(data.assets || []);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoadingSplits(false);
    }
  };

  const handleSelectSplit = (asset: any) => {
    setSelectedAsset(asset);
    setIsSplitsModalOpen(false);
    if (!facebookTitle) setFacebookTitle(asset.title);
    if (!youtubeTitle) setYoutubeTitle(asset.title);
  };

  const getNextGoldenSlot = () => {
    const slots = [9, 14, 21, 23, 1]; // 9 AM, 2 PM, 9 PM, 11 PM, 1 AM
    const now = new Date();
    const currentHour = now.getHours();

    let targetHour = slots.find((h) => h > currentHour);
    const targetDate = new Date();

    if (targetHour === undefined) {
      targetHour = slots[0];
      targetDate.setDate(targetDate.getDate() + 1);
    }

    // Apply random ±8 min jitter
    const jitter = Math.floor(Math.random() * 17) - 8;
    targetDate.setHours(targetHour, 0, 0, 0);
    targetDate.setMinutes(targetDate.getMinutes() + jitter);

    return targetDate;
  };

  const handleDispatchOmniPost = async () => {
    if (!channels.youtube && !channels.instagram && !channels.threads && !channels.facebook) {
      setNotice({
        isOpen: true,
        title: 'Channel Selection Required',
        message: 'Please select at least one publishing channel (Instagram, Threads, Facebook, or YouTube).',
        type: 'error',
      });
      return;
    }

    if (!selectedAsset) {
      setNotice({
        isOpen: true,
        title: 'Media Video Required',
        message: 'Please select a video from the Media Library or Studio Splits before publishing.',
        type: 'error',
      });
      return;
    }

    let finalScheduleAt: string | undefined = undefined;
    if (scheduleMode === 'golden_slot') {
      finalScheduleAt = getNextGoldenSlot().toISOString();
    } else if (scheduleMode === 'custom' && customDateTime) {
      finalScheduleAt = new Date(customDateTime).toISOString();
    }

    setIsSubmitting(true);
    try {
      const payload = {
        channels,
        mediaSource: {
          filename: selectedAsset.filename,
          localPath: selectedAsset.localPath,
          publicUrl: selectedAsset.publicUrl,
          duration: selectedAsset.duration,
          title: selectedAsset.title,
        },
        caption: masterCaption,
        platformCustomizations: {
          threads: {
            text: threadsText || masterCaption,
            topic: threadsTopic,
          },
          instagram: {
            caption: instagramCaption || masterCaption,
            shareToFeed: instagramShareGrid,
          },
          facebook: {
            title: facebookTitle || selectedAsset.title,
            description: facebookDescription || masterCaption,
          },
          youtube: {
            title: youtubeTitle || selectedAsset.title,
            tags: youtubeTags.split(',').map((t) => t.trim()),
          },
        },
        scheduleAt: finalScheduleAt,
        enableVaultCta,
      };

      const res = await fetch('/api/omni/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data: any;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(
          res.status >= 500
            ? `Server processing error (${res.status}). The Omni-Post operation timed out or failed on the server.`
            : `Server returned non-JSON response (${res.status}): ${text.slice(0, 100)}`
        );
      }
      if (data.success) {
        setNotice({
          isOpen: true,
          title: data.isImmediate ? 'Omni-Post Published!' : 'Omni-Post Scheduled!',
          message: data.isImmediate
            ? 'Your video clip has been published across all selected channels simultaneously.'
            : `Scheduled to publish at ${new Date(finalScheduleAt!).toLocaleString()} across selected channels.`,
          type: 'success',
        });
      } else {
        setNotice({
          isOpen: true,
          title: 'Publication Error',
          message: data.error || 'Failed to dispatch Omni-Post',
          type: 'error',
        });
      }
    } catch (err: any) {
      setNotice({
        isOpen: true,
        title: 'Network Error',
        message: String(err?.message || err),
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 lg:p-8 text-white border border-indigo-900/50 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Universal Omni-Post Studio
              </span>
            </div>
            <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              1-Click Multi-Platform Syndication
            </h2>
            <p className="text-xs text-indigo-200/80 leading-relaxed max-w-2xl">
              Write once, customize tags per network, and cross-publish or schedule to Instagram Reels, Threads, Facebook, and YouTube Shorts simultaneously.
            </p>
          </div>
        </div>
      </div>

      {/* STEP 1: SELECT TARGET CHANNELS */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center">
              1
            </span>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Target Publishing Channels
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">Select destinations</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {/* Threads */}
          <button
            type="button"
            onClick={() => toggleChannel('threads')}
            className={`p-4 rounded-2xl border text-left transition-all flex flex-col gap-2 relative ${
              channels.threads
                ? 'bg-purple-50/70 border-purple-400 shadow-sm'
                : 'bg-slate-50 border-slate-200 opacity-60 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
                <AtSign className="w-4 h-4" />
              </div>
              <input
                type="checkbox"
                checked={channels.threads}
                onChange={() => {}}
                className="rounded border-purple-400 text-purple-600 focus:ring-0"
              />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Meta Threads</span>
              <span className="text-[10px] text-slate-500">Curated hook &amp; video</span>
            </div>
          </button>

          {/* Instagram */}
          <button
            type="button"
            onClick={() => toggleChannel('instagram')}
            className={`p-4 rounded-2xl border text-left transition-all flex flex-col gap-2 relative ${
              channels.instagram
                ? 'bg-pink-50/70 border-pink-400 shadow-sm'
                : 'bg-slate-50 border-slate-200 opacity-60 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-600 text-white flex items-center justify-center font-bold">
                <Instagram className="w-4 h-4" />
              </div>
              <input
                type="checkbox"
                checked={channels.instagram}
                onChange={() => {}}
                className="rounded border-pink-400 text-pink-600 focus:ring-0"
              />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Instagram Reels</span>
              <span className="text-[10px] text-slate-500">9:16 vertical short</span>
            </div>
          </button>

          {/* Facebook */}
          <button
            type="button"
            onClick={() => toggleChannel('facebook')}
            className={`p-4 rounded-2xl border text-left transition-all flex flex-col gap-2 relative ${
              channels.facebook
                ? 'bg-blue-50/70 border-blue-400 shadow-sm'
                : 'bg-slate-50 border-slate-200 opacity-60 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                <Facebook className="w-4 h-4" />
              </div>
              <input
                type="checkbox"
                checked={channels.facebook}
                onChange={() => {}}
                className="rounded border-blue-400 text-blue-600 focus:ring-0"
              />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Facebook Page</span>
              <span className="text-[10px] text-slate-500">Reels &amp; page video</span>
            </div>
          </button>

          {/* YouTube Shorts */}
          <button
            type="button"
            onClick={() => toggleChannel('youtube')}
            className={`p-4 rounded-2xl border text-left transition-all flex flex-col gap-2 relative ${
              channels.youtube
                ? 'bg-red-50/70 border-red-400 shadow-sm'
                : 'bg-slate-50 border-slate-200 opacity-60 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold">
                <Youtube className="w-4 h-4" />
              </div>
              <input
                type="checkbox"
                checked={channels.youtube}
                onChange={() => {}}
                className="rounded border-red-400 text-red-600 focus:ring-0"
              />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">YouTube Shorts</span>
              <span className="text-[10px] text-slate-500">Short-form syndication</span>
            </div>
          </button>
        </div>
      </div>

      {/* STEP 2: VIDEO MEDIA SOURCE */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center">
              2
            </span>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Video Media Attachment
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsSplitsModalOpen(true);
                fetchStudioSplits();
              }}
              className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Choose from Studio Splits</span>
            </button>
          </div>
        </div>

        {selectedAsset ? (
          <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/40 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-24 h-24 rounded-xl bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
              <video src={selectedAsset.publicUrl} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-slate-900 block truncate">
                {selectedAsset.title}
              </span>
              <span className="text-[11px] font-mono text-slate-500 block truncate mt-0.5">
                {selectedAsset.filename}
              </span>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                  {selectedAsset.folderName}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                  {(selectedAsset.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsSplitsModalOpen(true);
                fetchStudioSplits();
              }}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shrink-0"
            >
              Change Clip
            </button>
          </div>
        ) : (
          <div
            onClick={() => {
              setIsSplitsModalOpen(true);
              fetchStudioSplits();
            }}
            className="border-2 border-dashed border-slate-300 hover:border-blue-400 p-8 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all bg-slate-50/50 hover:bg-blue-50/30"
          >
            <Film className="w-8 h-8 text-blue-500" />
            <span className="text-xs font-bold text-slate-700">No video clip selected</span>
            <span className="text-[11px] text-slate-400">Click to choose from your rendered Studio splits</span>
          </div>
        )}
      </div>

      {/* STEP 3: MASTER CAPTION & PLATFORM OVERRIDES */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center">
              3
            </span>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Post Content &amp; Platform Fine-Tuning
            </h3>
          </div>
        </div>

        {/* Master Caption Textarea */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700">Master Caption / Recommendation Hook</label>
          <textarea
            rows={4}
            value={masterCaption}
            onChange={(e) => setMasterCaption(e.target.value)}
            placeholder="Write your cinema breakdown, hook, and curiosity gap here..."
            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 leading-relaxed font-sans"
          />

          {/* Cinema Tag Pills */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Quick Tags:
            </span>
            {['#Cinema', '#Bollywood', '#MindBending', '#MovieRecommendation', '#CultClassic', '#MustWatch'].map(
              (tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 text-[11px] font-medium border border-slate-200 transition-all"
                >
                  {tag}
                </button>
              )
            )}
          </div>
        </div>

        {/* Movie Vault First-Reply CTA Toggle */}
        <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50/50 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-purple-950">Auto-Attach Movie Vault #VAULT Comment</span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-200 text-purple-900 uppercase">
                High Conversion
              </span>
            </div>
            <p className="text-[11px] text-purple-800/80 leading-relaxed">
              Automatically posts the curated Movie Vault CTA comment in the first reply across active platforms to capture audience leads.
            </p>
          </div>
          <input
            type="checkbox"
            checked={enableVaultCta}
            onChange={(e) => setEnableVaultCta(e.target.checked)}
            className="rounded border-purple-400 text-purple-600 focus:ring-0 mt-1 cursor-pointer"
          />
        </div>

        {/* Tabbed Platform Overrides */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-slate-500">Fine-tune per network:</span>
            {channels.threads && (
              <button
                type="button"
                onClick={() => setActivePlatformTab('threads')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activePlatformTab === 'threads' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Threads
              </button>
            )}
            {channels.instagram && (
              <button
                type="button"
                onClick={() => setActivePlatformTab('instagram')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activePlatformTab === 'instagram' ? 'bg-pink-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Instagram
              </button>
            )}
            {channels.facebook && (
              <button
                type="button"
                onClick={() => setActivePlatformTab('facebook')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activePlatformTab === 'facebook' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Facebook
              </button>
            )}
            {channels.youtube && (
              <button
                type="button"
                onClick={() => setActivePlatformTab('youtube')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activePlatformTab === 'youtube' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                YouTube
              </button>
            )}
          </div>

          {activePlatformTab === 'threads' && channels.threads && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700">Threads Topic &amp; Hook Customization</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {(threadsText || masterCaption).length} / 500 chars
                </span>
              </div>
              <input
                type="text"
                placeholder="Topic / Tag (e.g. Cinema, Thriller)"
                value={threadsTopic}
                onChange={(e) => setThreadsTopic(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
              />
            </div>
          )}

          {activePlatformTab === 'instagram' && channels.instagram && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="font-bold text-slate-700 text-xs block">Instagram Reels Settings</span>
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={instagramShareGrid}
                  onChange={(e) => setInstagramShareGrid(e.target.checked)}
                  className="rounded border-pink-400 text-pink-600 focus:ring-0"
                />
                <span>Also share Reel to Main Profile Grid</span>
              </label>
            </div>
          )}

          {activePlatformTab === 'facebook' && channels.facebook && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="font-bold text-slate-700 text-xs block">Facebook Video Title</span>
              <input
                type="text"
                placeholder="Video title for Facebook Page"
                value={facebookTitle}
                onChange={(e) => setFacebookTitle(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
              />
            </div>
          )}

          {activePlatformTab === 'youtube' && channels.youtube && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="font-bold text-slate-700 text-xs block">YouTube Shorts Title</span>
              <input
                type="text"
                placeholder="Shorts title (e.g. Unbelievable Plot Twist #Shorts)"
                value={youtubeTitle}
                onChange={(e) => setYoutubeTitle(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
              />
            </div>
          )}
        </div>
      </div>

      {/* STEP 4: SCHEDULING & DISPATCH */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center">
              4
            </span>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Publishing &amp; Slot Strategy
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setScheduleMode('now')}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              scheduleMode === 'now'
                ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <Send className="w-4 h-4 mb-1.5 text-blue-600" />
            <div className="text-xs">Publish Immediately</div>
            <div className="text-[10px] text-slate-400 font-normal">Push to all selected right now</div>
          </button>

          <button
            type="button"
            onClick={() => setScheduleMode('golden_slot')}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              scheduleMode === 'golden_slot'
                ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <Clock className="w-4 h-4 mb-1.5 text-amber-600" />
            <div className="text-xs">Next Golden Slot</div>
            <div className="text-[10px] text-slate-400 font-normal">Auto-align to 9AM, 2PM, 9PM, 11PM, 1AM</div>
          </button>

          <button
            type="button"
            onClick={() => setScheduleMode('custom')}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              scheduleMode === 'custom'
                ? 'bg-purple-50 border-purple-400 text-purple-900 font-bold shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <Calendar className="w-4 h-4 mb-1.5 text-purple-600" />
            <div className="text-xs">Custom Date &amp; Time</div>
            <div className="text-[10px] text-slate-400 font-normal">Pick specific slot</div>
          </button>
        </div>

        {scheduleMode === 'custom' && (
          <div className="pt-2">
            <input
              type="datetime-local"
              value={customDateTime}
              onChange={(e) => setCustomDateTime(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono"
            />
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleDispatchOmniPost}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
          >
            <Send className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
            <span>{isSubmitting ? 'Dispatching Across Networks...' : 'Launch Omni-Post'}</span>
          </button>
        </div>
      </div>

      {/* MODAL: CHOOSE FROM STUDIO SPLITS */}
      {isSplitsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Choose Clip from Studio Splits</h3>
              <button
                type="button"
                onClick={() => setIsSplitsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {studioSplits.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => handleSelectSplit(asset)}
                  className="p-3 rounded-2xl border border-slate-100 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30 flex items-center justify-between cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-slate-950 shrink-0 flex items-center justify-center overflow-hidden">
                      <video src={asset.publicUrl} className="w-full h-full object-cover" />
                    </div>
                    <div className="truncate">
                      <span className="text-xs font-bold text-slate-800 block truncate">{asset.title}</span>
                      <span className="text-[10px] font-mono text-slate-400 block truncate">{asset.filename}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs shrink-0"
                  >
                    Select
                  </button>
                </div>
              ))}

              {studioSplits.length === 0 && !isLoadingSplits && (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No rendered splits available. Render video parts in Studio &amp; Splitter first.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
