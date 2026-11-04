'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Link2,
  Folder,
  Send,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Youtube,
  Instagram,
  Smartphone,
  HardDrive,
  Copy,
  Check,
} from 'lucide-react';

interface QueueItem {
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
  };
  driveDetails?: {
    webViewLink?: string;
    fileName?: string;
  };
  createdAt: string;
}

interface DriveFolder {
  id: string;
  name: string;
}

export default function Dashboard() {
  const [url, setUrl] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('Shorts');
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch folders
  const fetchFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/folders');
      const data = await res.json();
      if (data.success && Array.isArray(data.folders)) {
        setFolders(data.folders);
        if (data.folders.length > 0 && !selectedFolder) {
          setSelectedFolder(data.folders[0].name);
        }
      }
    } catch {
      // Graceful fallback
    }
  }, [selectedFolder]);

  // Fetch queue items
  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/queue?limit=30');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setItems(data.items);
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFolders();
    fetchQueue();
    const interval = setInterval(fetchQueue, 15000);
    return () => clearInterval(interval);
  }, [fetchFolders, fetchQueue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    try {
      setIsSubmitting(true);
      const target = folders.find((f) => f.name === selectedFolder) || {
        id: selectedFolder.toLowerCase(),
        name: selectedFolder,
      };

      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          folderId: target.id,
          folderName: target.name,
          sourceClient: 'web_dashboard',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setUrl('');
        setNotice('Clip link successfully added to download queue.');
        fetchQueue();
        setTimeout(() => setNotice(null), 4000);
      } else {
        setNotice(data.error || 'Failed to queue clip.');
      }
    } catch {
      setNotice('Network error while queuing clip.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/queue/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchQueue();
      }
    } catch {
      // Ignore
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
            <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" /> Mac Downloading
          </span>
        );
      case 'uploading_to_drive':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <HardDrive className="w-3 h-3 text-indigo-600 animate-pulse" /> Uploading to Drive
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-3 h-3 text-red-600" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" /> Pending Mac Sync
          </span>
        );
    }
  };

  const getPlatformIcon = (platform: string) => {
    if (platform.includes('youtube')) {
      return <Youtube className="w-4 h-4 text-red-600" />;
    }
    if (platform.includes('instagram')) {
      return <Instagram className="w-4 h-4 text-pink-600" />;
    }
    return <Link2 className="w-4 h-4 text-slate-500" />;
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-700 mb-2">
            <Smartphone className="w-3.5 h-3.5 text-blue-600" />
            <span>Mobile Ingestion Cloud</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Clip Queue Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Receives shared links from your phone, stores queue in MongoDB Atlas, and synchronizes to Google Drive via VideoTimmer on your Mac.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchQueue}
          disabled={isLoading}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 shadow-sm transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Input / Fast Capture Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-blue-600" />
          <span>Quick Clip Ingestion</span>
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Video URL (YouTube, Shorts, or Instagram Reels):
              </label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/shorts/... or https://www.instagram.com/reel/..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Target Google Drive Folder:
              </label>
              <div className="relative">
                <select
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none font-semibold cursor-pointer"
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                  {!folders.some((f) => f.name === 'Shorts') && <option value="Shorts">Shorts</option>}
                  {!folders.some((f) => f.name === 'General') && <option value="General">General</option>}
                </select>
                <Folder className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {notice && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !url.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Enqueuing Clip...' : 'Add to Drive Queue'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Queue List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800">Active Clip Queue</h2>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
              {items.length} clips
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Auto-refreshes every 15s
          </span>
        </div>

        {items.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Folder className="w-8 h-8 mx-auto text-slate-300" />
            <div className="text-xs font-semibold text-slate-600">No clips currently queued</div>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Share video links from your phone or paste a URL above to add videos to your Google Drive queue.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div
                key={item._id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 rounded-xl px-2 transition-colors"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {getPlatformIcon(item.platform)}
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {item.contentMeta?.title || item.driveDetails?.fileName || item.cleanUrl}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-mono">
                    <span className="truncate max-w-xs">{item.cleanUrl}</span>
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
                      {item.targetFolder?.folderName || 'General'}
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
                      className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Open in Google Drive"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(item._id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Integration Guide Footer */}
      <div className="bg-slate-100/70 rounded-2xl p-5 border border-slate-200 text-xs text-slate-600 space-y-2">
        <div className="font-bold text-slate-800 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-slate-700" />
          <span>Vercel Cloud Deployment Info</span>
        </div>
        <p className="text-[11px] leading-relaxed">
          This microservice is ready for 1-click deployment on Vercel. Set the environment variable{' '}
          <code className="px-1.5 py-0.5 bg-white rounded border border-slate-300 text-slate-800 font-mono">MONGODB_URI</code>{' '}
          in your Vercel Project Settings to your MongoDB Atlas cluster. VideoTimmer on your Mac reads the same database to automatically download queued clips and upload them to Google Drive.
        </p>
      </div>
    </main>
  );
}

