'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Smartphone,
  CloudDownload,
  Folder,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Play,
  Trash2,
  Youtube,
  Instagram,
  HardDrive,
  Copy,
  Check,
  Send,
  Link2,
} from 'lucide-react';

interface ClipQueueItem {
  _id: string;
  url: string;
  cleanUrl: string;
  platform: string;
  status: string;
  targetFolder: {
    folderId: string;
    folderName: string;
  };
  contentMeta?: {
    title?: string;
    author?: string;
    durationSeconds?: number;
  };
  driveDetails?: {
    webViewLink?: string;
    fileName?: string;
    fileSizeBytes?: number;
  };
  createdAt: string;
}

export function ClipIngestQueueView() {
  const [items, setItems] = useState<ClipQueueItem[]>([]);
  const [counts, setCounts] = useState({
    all: 0,
    pending: 0,
    completed: 0,
    failed: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncingFolders, setIsSyncingFolders] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('Shorts');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/ingest/queue?limit=50');
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        if (data.counts) {
          setCounts(data.counts);
        }
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const handleProcessNow = async () => {
    try {
      setIsProcessing(true);
      const res = await fetch('/api/ingest/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process_pending' }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage('Started processing pending clips in background via yt-dlp.');
        setTimeout(() => fetchQueue(), 2000);
      }
    } catch {
      setStatusMessage('Failed to start queue processor.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyncFolders = async () => {
    try {
      setIsSyncingFolders(true);
      const res = await fetch('/api/ingest/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_folders' }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage(data.message || 'Google Drive folders synced to cloud registry.');
      }
    } catch {
      setStatusMessage('Failed to sync folders.');
    } finally {
      setIsSyncingFolders(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    try {
      const res = await fetch('/api/ingest/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process_pending',
        }),
      });
      if (res.ok) {
        setUrlInput('');
        fetchQueue();
      }
    } catch {
      // Graceful fallback
    }
  };

  const handleCopyLink = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Uploaded to Drive
          </span>
        );
      case 'downloading':
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" /> Downloading (Mac)
          </span>
        );
      case 'uploading_to_drive':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <HardDrive className="w-3 h-3 text-indigo-600 animate-pulse" /> Streaming to Drive
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-3 h-3 text-red-600" /> Download Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" /> Pending Download
          </span>
        );
    }
  };

  const getPlatformIcon = (platform: string) => {
    if (platform?.includes('youtube')) {
      return <Youtube className="w-4 h-4 text-red-600 shrink-0" />;
    }
    if (platform?.includes('instagram')) {
      return <Instagram className="w-4 h-4 text-pink-600 shrink-0" />;
    }
    return <Link2 className="w-4 h-4 text-slate-500 shrink-0" />;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full animate-fadeIn">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold tracking-wide border border-white/20">
              <Smartphone className="w-3.5 h-3.5 text-white" />
              <span>Mobile Phone Ingestion Bridge</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              Cloud Clip Ingest & Drive Staging
            </h1>
            <p className="text-sm text-blue-100 max-w-2xl">
              Captures video links shared from your phone (YouTube Shorts, Videos, and Instagram Reels), downloads the high-res MP4 streams locally on your Mac, and uploads them directly into your Google Drive folders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleProcessNow}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{isProcessing ? 'Processing Queue...' : 'Process Pending Queue'}</span>
            </button>

            <button
              type="button"
              disabled={isSyncingFolders}
              onClick={handleSyncFolders}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-xs border border-white/20 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFolders ? 'animate-spin' : ''}`} />
              <span>Sync Folders to Cloud</span>
            </button>

            <a
              href="https://clip-queue-server.vercel.app"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-xs border border-white/20 transition-all"
              title="Open Vercel Cloud Server Dashboard"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Cloud Server</span>
            </a>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Ingested</div>
          <div className="text-2xl font-black text-slate-800">{counts.all}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200/80 bg-amber-50/20 shadow-sm space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Pending on Phone
          </div>
          <div className="text-2xl font-black text-amber-700">{counts.pending}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/20 shadow-sm space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Staged in Drive
          </div>
          <div className="text-2xl font-black text-emerald-700">{counts.completed}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-red-200/80 bg-red-50/20 shadow-sm space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-red-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Failed
          </div>
          <div className="text-2xl font-black text-red-700">{counts.failed}</div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CloudDownload className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-800">Clips Received from Phone & Cloud</h2>
          </div>
          <button
            type="button"
            onClick={fetchQueue}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Folder className="w-8 h-8 mx-auto text-slate-300" />
            <div className="text-xs font-semibold text-slate-600">No clips in the ingestion queue</div>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Share a link from YouTube or Instagram on your mobile phone to have it downloaded and placed directly into Google Drive.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div
                key={item._id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 rounded-xl px-2 transition-colors"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {getPlatformIcon(item.platform)}
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {item.contentMeta?.title || item.driveDetails?.fileName || item.cleanUrl}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-mono">
                    <span className="truncate max-w-sm">{item.cleanUrl}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(item._id, item.cleanUrl)}
                      className="p-1 hover:text-slate-800 transition-colors"
                      title="Copy URL"
                    >
                      {copiedId === item._id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                    <span className="text-slate-300">|</span>
                    <span className="inline-flex items-center gap-1 font-sans font-semibold text-slate-600">
                      <Folder className="w-3 h-3 text-slate-400" />
                      Drive Folder: <strong className="text-slate-800">{item.targetFolder?.folderName || 'General'}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  {getStatusBadge(item.status)}

                  {item.driveDetails?.webViewLink && (
                    <a
                      href={item.driveDetails.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors"
                    >
                      <span>Open in Drive</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

