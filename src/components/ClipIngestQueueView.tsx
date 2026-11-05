'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Search,
  Filter,
  Download,
  Sparkles,
  Users,
  Cpu,
  Layers,
  ArrowRight,
  Plus,
  ShieldCheck,
  FileText,
  Tag,
  Radio,
} from 'lucide-react';
import { NoticeModal } from './ui/NoticeModal';

export type ClipIngestSubTab = 'table' | 'vault-leads' | 'worker';

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
    notes?: string;
    tags?: string[];
  };
  driveDetails?: {
    webViewLink?: string;
    fileName?: string;
    fileSizeBytes?: number;
  };
  executionMeta?: {
    sourceClient?: {
      type?: string;
      deviceInfo?: string;
      appVersion?: string;
    };
  };
  createdAt: string;
}

interface WorkerHeartbeatStatus {
  isOnline: boolean;
  isRunning?: boolean;
  activeIngests?: number;
  lastPingAt?: string;
  secondsAgo?: number;
  metadata?: {
    hostname?: string;
    pid?: number;
  };
}

interface ClipIngestQueueViewProps {
  initialSubTab?: ClipIngestSubTab;
  onNavigateTab?: (tab: any) => void;
}

export function ClipIngestQueueView({
  initialSubTab = 'table',
  onNavigateTab,
}: ClipIngestQueueViewProps) {
  const [subTab, setSubTab] = useState<ClipIngestSubTab>(initialSubTab);

  const [items, setItems] = useState<ClipQueueItem[]>([]);
  const [counts, setCounts] = useState({
    all: 0,
    pending: 0,
    completed: 0,
    failed: 0,
    vaultLeads: 0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncingFolders, setIsSyncingFolders] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [folderFilter, setFolderFilter] = useState('all');
  const [onlyLeadsFilter, setOnlyLeadsFilter] = useState(false);

  // Live worker heartbeat
  const [heartbeat, setHeartbeat] = useState<WorkerHeartbeatStatus>({ isOnline: false });

  // Notice Modal
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

  // Manual Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [manualFolder, setManualFolder] = useState('Shorts');
  const [manualNotes, setManualNotes] = useState('');
  const [isAddingManual, setIsAddingManual] = useState(false);

  // Sync subTab with initialSubTab prop if changed from sidebar
  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Fetch items from queue API with current filters
  const fetchQueue = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (platformFilter !== 'all') params.set('platform', platformFilter);
      if (folderFilter !== 'all') params.set('folder', folderFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (onlyLeadsFilter || subTab === 'vault-leads') params.set('onlyLeads', 'true');

      const res = await fetch(`/api/ingest/queue?${params.toString()}`);
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
  }, [statusFilter, platformFilter, folderFilter, searchQuery, onlyLeadsFilter, subTab]);

  // Fetch Mac worker heartbeat
  const fetchHeartbeat = useCallback(async () => {
    try {
      const res = await fetch('https://clip-queue-server.vercel.app/api/worker/heartbeat', {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setHeartbeat(data);
      }
    } catch {
      // Offline fallback
      setHeartbeat({ isOnline: false });
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    fetchHeartbeat();
    const interval = setInterval(() => {
      fetchQueue();
      fetchHeartbeat();
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchQueue, fetchHeartbeat]);

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
        setNotice({
          isOpen: true,
          title: 'Queue Processor Triggered',
          message: 'The Mac background engine is now downloading pending clips and uploading them to Google Drive.',
          type: 'success',
        });
        setTimeout(() => fetchQueue(), 1500);
      } else {
        throw new Error(data.error || 'Failed to trigger processor');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({
        isOpen: true,
        title: 'Processor Notice',
        message: msg,
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessSingle = async (id: string) => {
    try {
      const res = await fetch('/api/ingest/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process_single', id }),
      });
      const data = await res.json();
      if (data.success) {
        setNotice({
          isOpen: true,
          title: 'Clip Processing Started',
          message: 'Downloading clip and transferring to your Drive folder now.',
          type: 'success',
        });
        setTimeout(() => fetchQueue(), 1500);
      }
    } catch {
      // Graceful error
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
        setNotice({
          isOpen: true,
          title: 'Folders Synchronized',
          message: data.message || 'Drive folder tree registered with cloud API successfully.',
          type: 'success',
        });
      }
    } catch {
      setNotice({
        isOpen: true,
        title: 'Sync Error',
        message: 'Could not connect to Google Drive service.',
        type: 'error',
      });
    } finally {
      setIsSyncingFolders(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const res = await fetch(`/api/ingest/queue?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) => prev.filter((item) => item._id !== id));
      }
    } catch {
      // Graceful error
    }
  };

  const handlePromoteToVaultLead = async (id: string) => {
    try {
      const res = await fetch('/api/ingest/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'promote_to_vault_lead', id }),
      });
      const data = await res.json();
      if (data.success) {
        setNotice({
          isOpen: true,
          title: 'Lead Promoted to CRM',
          message: 'Clip note has been officially added as a lead in Movie Vault CRM.',
          type: 'success',
        });
      }
    } catch {
      // Graceful error
    }
  };

  const handleCopyLink = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCsv = () => {
    if (items.length === 0) return;
    const headers = ['Platform', 'Title', 'Clean URL', 'Target Folder', 'Notes', 'Status', 'Drive Link', 'Created At'];
    const rows = items.map((i) => [
      i.platform,
      `"${(i.contentMeta?.title || '').replace(/"/g, '""')}"`,
      `"${i.cleanUrl}"`,
      i.targetFolder?.folderName || 'General',
      `"${(i.contentMeta?.notes || '').replace(/"/g, '""')}"`,
      i.status,
      i.driveDetails?.webViewLink || '',
      i.createdAt,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `clip_ingest_leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleManualAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrl.trim()) return;

    try {
      setIsAddingManual(true);
      const res = await fetch('https://clip-queue-server.vercel.app/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: manualUrl.trim(),
          folderName: manualFolder,
          folderId: manualFolder,
          notes: manualNotes.trim() || undefined,
          sourceClient: 'desktop_dashboard',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAddModalOpen(false);
        setManualUrl('');
        setManualNotes('');
        setNotice({
          isOpen: true,
          title: 'Link Added to Ingest Queue',
          message: 'The link was queued and will be downloaded to Google Drive.',
          type: 'success',
        });
        fetchQueue();
      }
    } catch {
      setNotice({
        isOpen: true,
        title: 'Submission Failed',
        message: 'Could not submit link to ingestion queue.',
        type: 'error',
      });
    } finally {
      setIsAddingManual(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Staged in Drive
          </span>
        );
      case 'downloading':
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" /> Mac Downloading
          </span>
        );
      case 'uploading_to_drive':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <HardDrive className="w-3 h-3 text-indigo-600 animate-pulse" /> Drive Streaming
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-3 h-3 text-red-600" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" /> Pending Ingest
          </span>
        );
    }
  };

  const getPlatformBadge = (platform: string) => {
    if (platform?.includes('instagram')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-pink-50 text-pink-700 border border-pink-200">
          <Instagram className="w-3 h-3 text-pink-600" /> Instagram
        </span>
      );
    }
    if (platform?.includes('youtube')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
          <Youtube className="w-3 h-3 text-red-600" /> YouTube
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
        <Link2 className="w-3 h-3 text-slate-500" /> Web Link
      </span>
    );
  };

  const getFolderBadge = (name: string) => {
    switch (name?.toLowerCase()) {
      case 'shorts':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Folder className="w-3 h-3 text-purple-600" /> Shorts
          </span>
        );
      case 'movie-vault':
      case 'vault':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Sparkles className="w-3 h-3 text-amber-600" /> Movie-Vault
          </span>
        );
      case 'gta-5':
      case 'gta':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Folder className="w-3 h-3 text-emerald-600" /> GTA-5
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Folder className="w-3 h-3 text-blue-600" /> {name || 'General'}
          </span>
        );
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Filter items specifically for #VAULT Leads tab
  const vaultLeadItems = useMemo(() => {
    return items.filter(
      (i) =>
        (i.contentMeta?.notes && i.contentMeta.notes.trim().length > 0) ||
        i.targetFolder?.folderName?.toLowerCase().includes('vault') ||
        (i.contentMeta?.tags && i.contentMeta.tags.some((t) => t.toLowerCase().includes('vault')))
    );
  }, [items]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full animate-fadeIn pb-12">
      {/* Top Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-800 via-blue-800 to-indigo-900 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold tracking-wide border border-white/20">
              <Smartphone className="w-3.5 h-3.5 text-sky-300" />
              <span>Mobile Ingestion & Lead Hub</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              Mobile Ingest, Links & Leads
            </h1>
            <p className="text-sm text-sky-100 max-w-2xl">
              Captures all videos and content notes shared from your mobile app (Instagram Reels, YouTube Shorts & Videos), stages high-res MP4 files in Google Drive, and routes #VAULT community leads directly into your workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleProcessNow}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-blue-900 hover:bg-blue-50 font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{isProcessing ? 'Processing Queue...' : 'Process Pending Queue'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-xs border border-white/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Link</span>
            </button>

            <button
              type="button"
              disabled={isSyncingFolders}
              onClick={handleSyncFolders}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-xs border border-white/20 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFolders ? 'animate-spin' : ''}`} />
              <span>Sync Drive</span>
            </button>

            <a
              href="https://clip-queue-server.vercel.app"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-xs border border-white/20 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Cloud Server</span>
            </a>
          </div>
        </div>
      </div>

      {/* Primary Sub-Tabs Navigation (Like Instagram tab) */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('table')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              subTab === 'table'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Ingested Table</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                subTab === 'table' ? 'bg-sky-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('vault-leads')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              subTab === 'vault-leads'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>App #VAULT Leads</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                subTab === 'vault-leads' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {counts.vaultLeads}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('worker')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              subTab === 'worker'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Worker & Cloud Staging</span>
            <span
              className={`w-2 h-2 rounded-full ${
                heartbeat.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
              }`}
            />
          </button>
        </div>

        {/* Live Mac Worker Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600">
          <Cpu className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-semibold text-slate-700">Mac Worker:</span>
          {heartbeat.isOnline ? (
            <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Online ({heartbeat.secondsAgo ?? 0}s ago)
            </span>
          ) : (
            <span className="font-semibold text-slate-500">Idle / Sleeping</span>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Ingested</div>
          <div className="text-2xl font-black text-slate-800">{counts.all}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200/80 bg-amber-50/20 shadow-xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Pending Download
          </div>
          <div className="text-2xl font-black text-amber-700">{counts.pending}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Staged in Drive
          </div>
          <div className="text-2xl font-black text-emerald-700">{counts.completed}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-purple-200/80 bg-purple-50/20 shadow-xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-purple-600 flex items-center gap-1">
            <Users className="w-3 h-3" /> Tagged #VAULT Leads
          </div>
          <div className="text-2xl font-black text-purple-700">{counts.vaultLeads}</div>
        </div>
      </div>

      {/* SUB-TAB 1: ALL INGESTED TABLE */}
      {subTab === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Filter & Search Bar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by URL, title, note, or author..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500 bg-white"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white text-slate-700 font-semibold focus:outline-hidden"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed in Drive</option>
                <option value="failed">Failed</option>
              </select>

              {/* Platform Filter */}
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white text-slate-700 font-semibold focus:outline-hidden"
              >
                <option value="all">All Platforms</option>
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
              </select>

              {/* Folder Filter */}
              <select
                value={folderFilter}
                onChange={(e) => setFolderFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white text-slate-700 font-semibold focus:outline-hidden"
              >
                <option value="all">All Folders</option>
                <option value="Shorts">Shorts</option>
                <option value="Movie-Vault">Movie-Vault</option>
                <option value="GTA-5">GTA-5</option>
                <option value="General">General</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setOnlyLeadsFilter((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                  onlyLeadsFilter
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>#VAULT Leads Only</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors"
                title="Export Table to CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={fetchQueue}
                className="p-1.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
                title="Refresh Table"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* Table Container */}
          {items.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Folder className="w-10 h-10 mx-auto text-slate-300" />
              <div className="text-sm font-semibold text-slate-700">No clips found in table</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'all' || platformFilter !== 'all'
                  ? 'No clips match the current filters. Try resetting the filters.'
                  : 'Share a link from YouTube or Instagram on your phone app to see it populate here instantly.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Platform & Source URL</th>
                    <th className="py-3 px-4">Content Title / Author</th>
                    <th className="py-3 px-4">Target Folder</th>
                    <th className="py-3 px-4">Lead Context / Notes</th>
                    <th className="py-3 px-4">Device & Time</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {items.map((item) => {
                    const isVaultTagged =
                      (item.contentMeta?.notes && item.contentMeta.notes.toLowerCase().includes('vault')) ||
                      item.targetFolder?.folderName?.toLowerCase().includes('vault');

                    return (
                      <tr key={item._id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Platform & Source URL */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              {getPlatformBadge(item.platform)}
                            </div>
                            <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500">
                              <span className="truncate max-w-[200px]" title={item.cleanUrl}>
                                {item.cleanUrl}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyLink(item._id, item.cleanUrl)}
                                className="p-0.5 hover:text-slate-800 transition-colors text-slate-400"
                                title="Copy clean link"
                              >
                                {copiedId === item._id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Title / Author */}
                        <td className="py-3 px-4 max-w-sm">
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-900 line-clamp-1">
                              {item.contentMeta?.title || item.driveDetails?.fileName || 'Clip Stream'}
                            </div>
                            {item.contentMeta?.author ? (
                              <div className="text-[10px] text-slate-400 truncate">
                                by {item.contentMeta.author}
                              </div>
                            ) : null}
                          </div>
                        </td>

                        {/* Target Folder */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {getFolderBadge(item.targetFolder?.folderName || 'General')}
                        </td>

                        {/* Lead Context & Notes */}
                        <td className="py-3 px-4 max-w-xs">
                          {item.contentMeta?.notes ? (
                            <div className="space-y-1">
                              <div className="text-[11px] text-slate-800 font-medium line-clamp-2">
                                {item.contentMeta.notes}
                              </div>
                              {isVaultTagged && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                  <Sparkles className="w-2.5 h-2.5 text-amber-600" /> #VAULT Lead
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 italic text-[11px]">No notes</span>
                          )}
                        </td>

                        {/* Device & Time */}
                        <td className="py-3 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                          <div>{formatRelativeTime(item.createdAt)}</div>
                          <div className="text-[10px] text-slate-400">
                            {item.executionMeta?.sourceClient?.type || 'Android App'}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">{getStatusBadge(item.status)}</td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Open in Drive Button */}
                            {item.driveDetails?.webViewLink && (
                              <a
                                href={item.driveDetails.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold transition-colors"
                                title="Open File in Google Drive"
                              >
                                <span>Drive</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}

                            {/* Process Single if pending or failed */}
                            {item.status !== 'completed' && (
                              <button
                                type="button"
                                onClick={() => handleProcessSingle(item._id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Process this clip now"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Promote to Vault Lead */}
                            {item.contentMeta?.notes && (
                              <button
                                type="button"
                                onClick={() => handlePromoteToVaultLead(item._id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                title="Promote note to Movie Vault CRM"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete Item */}
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item._id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete from Queue"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: APP #VAULT LEADS */}
      {subTab === 'vault-leads' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold block">Movie Vault Leads & Context Notes</span>
                <span className="text-amber-700">
                  These are items tagged with notes or #VAULT shared directly from your phone app. You can promote them directly into your Movie Vault CRM for DM follow-up.
                </span>
              </div>
            </div>

            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('vault-crm')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition-colors shrink-0"
              >
                <span>Open Vault CRM</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {vaultLeadItems.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Users className="w-10 h-10 mx-auto text-slate-300" />
                <div className="text-sm font-semibold text-slate-700">No #VAULT leads captured yet</div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  When sharing a clip from Instagram or YouTube on your phone, type `#VAULT` or contact notes in the quick note field to stage leads here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Contact / Author</th>
                      <th className="py-3 px-4">Platform</th>
                      <th className="py-3 px-4">Note / Comment Details</th>
                      <th className="py-3 px-4">Target Drive Folder</th>
                      <th className="py-3 px-4">Captured</th>
                      <th className="py-3 px-4 text-right">Promote to CRM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {vaultLeadItems.map((item) => (
                      <tr key={item._id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {item.contentMeta?.author ? `@${item.contentMeta.author}` : 'App User'}
                        </td>
                        <td className="py-3 px-4">{getPlatformBadge(item.platform)}</td>
                        <td className="py-3 px-4 max-w-md">
                          <div className="space-y-0.5">
                            <p className="font-semibold text-slate-800">{item.contentMeta?.notes}</p>
                            <span className="text-[10px] text-slate-400 font-mono truncate block max-w-sm">
                              {item.cleanUrl}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">{getFolderBadge(item.targetFolder?.folderName)}</td>
                        <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                          {formatRelativeTime(item.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handlePromoteToVaultLead(item._id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200 transition-colors"
                          >
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            <span>Add to CRM</span>
                          </button>
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

      {/* SUB-TAB 3: WORKER & DRIVE STAGING */}
      {subTab === 'worker' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Live Worker Telemetry */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-bold text-slate-800">Mac Rendering Worker Status</h3>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  heartbeat.isOnline
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {heartbeat.isOnline ? 'Online & Ready' : 'Idle / Sleeping'}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Worker Engine</span>
                <span className="font-semibold text-slate-800">Mac Clip Ingestion & yt-dlp</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Last Telemetry Ping</span>
                <span className="font-semibold text-slate-800">
                  {heartbeat.lastPingAt
                    ? `${formatRelativeTime(heartbeat.lastPingAt)} (${heartbeat.secondsAgo ?? 0}s ago)`
                    : 'No heartbeat received yet'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Worker Hostname</span>
                <span className="font-mono text-slate-700">{heartbeat.metadata?.hostname || 'Localhost Mac'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500">Active Queue Tasks</span>
                <span className="font-bold text-slate-800">{counts.pending} items waiting</span>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleProcessNow}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Process Pending Ingestion</span>
              </button>
            </div>
          </div>

          {/* Card 2: Google Drive Staging Folders */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">Google Drive Destination Folders</h3>
              </div>
              <button
                type="button"
                disabled={isSyncingFolders}
                onClick={handleSyncFolders}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncingFolders ? 'animate-spin' : ''}`} />
                <span>Sync Folders</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-bold text-purple-900">Shorts</span>
                </div>
                <span className="text-[10px] text-purple-700 font-semibold">9:16 Vertical Reels & Shorts</span>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-amber-900">Movie-Vault</span>
                </div>
                <span className="text-[10px] text-amber-700 font-semibold">Vault recommendations & gems</span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-900">GTA-5</span>
                </div>
                <span className="text-[10px] text-emerald-700 font-semibold">Gaming & stream captures</span>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-blue-900">General</span>
                </div>
                <span className="text-[10px] text-blue-700 font-semibold">Long-form video downloads</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Link Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-bold text-slate-800">Add Link to Ingest Queue</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualAddSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Video Link URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://instagram.com/reel/... or YouTube URL"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Target Drive Folder</label>
                <select
                  value={manualFolder}
                  onChange={(e) => setManualFolder(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                >
                  <option value="Shorts">Shorts</option>
                  <option value="Movie-Vault">Movie-Vault</option>
                  <option value="GTA-5">GTA-5</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Optional Context Note / #VAULT</label>
                <input
                  type="text"
                  placeholder="e.g. #VAULT thriller ending, or client lead"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingManual}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-sm disabled:opacity-50"
                >
                  {isAddingManual ? 'Queueing...' : 'Add to Queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notice Modal */}
      <NoticeModal
        isOpen={notice.isOpen}
        title={notice.title}
        message={notice.message}
        type={notice.type}
        onClose={() => setNotice((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
