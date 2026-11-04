'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Film,
  Folder,
  Search,
  Filter,
  Play,
  Download,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Clock,
  Layers,
  HardDrive,
  RefreshCw,
  Share2,
  Youtube,
  Instagram,
  AtSign,
  Facebook,
  Scissors,
  Check,
  Send,
} from 'lucide-react';
import { CustomSelect } from './ui/CustomSelect';
import { NoticeModal } from './ui/NoticeModal';

export interface MediaAssetItem {
  id: string;
  filename: string;
  title: string;
  sourceType: 'rendered_split' | 'raw_upload' | 'drive';
  localPath: string;
  publicUrl?: string;
  sizeBytes: number;
  duration?: number;
  dimensions?: { width: number; height: number };
  createdAt: string;
  folderName: string;
  jobId?: string;
  partIndex?: number;
  topText?: string;
  bottomText?: string;
  syndication: {
    youtube: { posted: boolean; permalink?: string };
    instagram: { posted: boolean; permalink?: string };
    threads: { posted: boolean; permalink?: string };
    facebook: { posted: boolean; permalink?: string };
  };
}

interface MediaLibraryViewProps {
  onSelectForOmniPost?: (asset: MediaAssetItem) => void;
}

export function MediaLibraryView({ onSelectForOmniPost }: MediaLibraryViewProps) {
  const [assets, setAssets] = useState<MediaAssetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState('all');
  const [syndicationFilter, setSyndicationFilter] = useState('all');
  const [previewAsset, setPreviewAsset] = useState<MediaAssetItem | null>(null);

  const [metrics, setMetrics] = useState({
    totalAssets: 0,
    renderedSplits: 0,
    rawUploads: 0,
    unpostedCount: 0,
    totalDiskBytes: 0,
  });

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

  const fetchAssets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (folderFilter !== 'all') params.set('folderName', folderFilter);
      if (syndicationFilter !== 'all') params.set('syndicationFilter', syndicationFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/media/library?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setAssets(data.assets || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
    }
  }, [folderFilter, syndicationFilter, searchQuery]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleDeleteAsset = async (id: string, filename: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    try {
      await fetch(`/api/media/library?id=${id}`, { method: 'DELETE' });
      setNotice({
        isOpen: true,
        title: 'Asset Deleted',
        message: `Successfully removed ${filename} from library and disk.`,
        type: 'info',
      });
    } catch {
      fetchAssets();
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-[#90CAF9] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
              <Film className="w-5 h-5 text-[#2196F3]" />
            </span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Unified Media Asset Library
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Central repository of rendered video splits, AI highlight reels, and source cuts with cross-network syndication tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchAssets}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2196F3] hover:bg-[#1976D2] text-white text-xs font-semibold shadow-md shadow-[#2196F3]/25 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Library</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Clips
            </span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-0.5 block">
              {metrics.totalAssets}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
              Unpublished
            </span>
            <span className="text-2xl font-black text-amber-900 font-mono mt-0.5 block">
              {metrics.unpostedCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider block">
              Rendered Splits
            </span>
            <span className="text-2xl font-black text-purple-900 font-mono mt-0.5 block">
              {metrics.renderedSplits}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
            <Scissors className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Disk Consumed
            </span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-0.5 block">
              {formatBytes(metrics.totalDiskBytes)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filters:</span>
          </div>

          <div className="w-40">
            <CustomSelect
              value={syndicationFilter}
              onChange={(val) => setSyndicationFilter(val)}
              size="sm"
              options={[
                { value: 'all', label: 'All Syndication' },
                { value: 'unposted', label: 'Unposted Only' },
                { value: 'posted_any', label: 'Syndicated on Any' },
              ]}
            />
          </div>

          <div className="w-40">
            <CustomSelect
              value={folderFilter}
              onChange={(val) => setFolderFilter(val)}
              size="sm"
              options={[
                { value: 'all', label: 'All Folders' },
                { value: 'General', label: 'General' },
                { value: 'Bollywood', label: 'Bollywood' },
                { value: 'Hollywood', label: 'Hollywood' },
                { value: 'Cinema', label: 'Cinema' },
              ]}
            />
          </div>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search filename or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
          />
        </div>
      </div>

      {/* Video Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden group"
          >
            {/* Thumbnail / Video Preview Area */}
            <div className="relative bg-slate-950 aspect-[9/12] max-h-72 flex items-center justify-center overflow-hidden border-b border-slate-100">
              <video
                src={asset.publicUrl}
                preload="metadata"
                controls
                className="w-full h-full object-contain"
              />

              {/* Badges on Top */}
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-sm text-white border border-white/20">
                  {formatDuration(asset.duration)}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-sm text-blue-400 border border-white/20">
                  {formatBytes(asset.sizeBytes)}
                </span>
              </div>

              {asset.folderName && (
                <div className="absolute top-2.5 right-2.5 pointer-events-none">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600/90 text-white backdrop-blur-sm">
                    {asset.folderName}
                  </span>
                </div>
              )}
            </div>

            {/* Asset Metadata Info */}
            <div className="p-4 flex flex-col flex-1 gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 line-clamp-1 leading-snug" title={asset.title}>
                  {asset.title}
                </h4>
                <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                  {asset.filename}
                </p>
              </div>

              {/* Cross-Platform Syndication Status Badges */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Syndication:
                </span>

                <div className="flex items-center gap-1.5">
                  {/* YouTube */}
                  <span
                    className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                      asset.syndication.youtube.posted
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : 'bg-slate-100 text-slate-400 opacity-60'
                    }`}
                    title={asset.syndication.youtube.posted ? 'Published on YouTube' : 'Not on YouTube'}
                  >
                    <Youtube className="w-3.5 h-3.5" />
                  </span>

                  {/* Instagram */}
                  <span
                    className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                      asset.syndication.instagram.posted
                        ? 'bg-pink-50 text-pink-600 border border-pink-200'
                        : 'bg-slate-100 text-slate-400 opacity-60'
                    }`}
                    title={asset.syndication.instagram.posted ? 'Published on Instagram' : 'Not on Instagram'}
                  >
                    <Instagram className="w-3.5 h-3.5" />
                  </span>

                  {/* Threads */}
                  <span
                    className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                      asset.syndication.threads.posted
                        ? 'bg-purple-50 text-purple-600 border border-purple-200'
                        : 'bg-slate-100 text-slate-400 opacity-60'
                    }`}
                    title={asset.syndication.threads.posted ? 'Published on Threads' : 'Not on Threads'}
                  >
                    <AtSign className="w-3.5 h-3.5" />
                  </span>

                  {/* Facebook */}
                  <span
                    className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                      asset.syndication.facebook.posted
                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                        : 'bg-slate-100 text-slate-400 opacity-60'
                    }`}
                    title={asset.syndication.facebook.posted ? 'Published on Facebook' : 'Not on Facebook'}
                  >
                    <Facebook className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              {/* Bottom Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                <button
                  type="button"
                  onClick={() => onSelectForOmniPost && onSelectForOmniPost(asset)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#2196F3] hover:bg-[#1976D2] text-white text-xs font-bold shadow-xs transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Omni-Post Clip</span>
                </button>

                <a
                  href={asset.publicUrl}
                  download={asset.filename}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                  title="Download MP4"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => handleDeleteAsset(asset.id, asset.filename)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                  title="Delete from disk"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {assets.length === 0 && !isLoading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2 shadow-xs">
          <Film className="w-8 h-8 text-slate-300" />
          <span className="font-semibold text-slate-600 text-sm">No media assets found in library</span>
          <span>Render video parts in Studio &amp; Splitter to see them indexed here automatically.</span>
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

