'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  FolderSync,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Terminal,
  Save,
  Search,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Trash2,
  HardDrive,
  Info,
  Globe,
  Instagram,
  BookOpen,
  Activity,
  Youtube,
  AtSign,
  Facebook,
  Plus,
  RefreshCw,
  Check,
  Layers,
  Sparkles,
  Clock,
  Users,
  BarChart3,
} from 'lucide-react';
import { CustomSelect, SelectOption } from './ui/CustomSelect';
import { NoticeModal } from './ui/NoticeModal';
import { MetaConnectionGuideView } from './MetaConnectionGuideView';
import { McpServerDocsView } from './McpServerDocsView';
import { safeFetchJson } from '@/lib/safeJson';

interface SettingsData {
  googleDrive: {
    connected: boolean;
    folderId?: string;
    folderName?: string;
    userEmail?: string;
    lastTestedAt?: string;
    authType?: string;
  };
  threads?: {
    appId: string;
    appSecret: string;
    hasAppSecret: boolean;
    redirectUri: string;
  };
  instagram?: {
    appId: string;
    appSecret: string;
    hasAppSecret: boolean;
    redirectUri: string;
  };
  defaults: {
    reframeMode: string;
    qualityPreset: string;
    fontFamily: string;
    filenameTemplate: string;
  };
  limits: {
    maxUploadSizeMb: number;
    maxParts: number;
    concurrency: number;
  };
}

interface YouTubeAccountItem {
  channelId: string;
  channelTitle: string;
  channelAvatarUrl?: string;
  subscriberCount?: number;
  isActive: boolean;
}

interface InstagramAccountItem {
  _id: string;
  username: string;
  profilePictureUrl?: string;
  followerCount?: number;
  mediaCount?: number;
  isActive: boolean;
}

interface ThreadsAccountItem {
  _id: string;
  username: string;
  profilePictureUrl?: string;
  followerCount?: number;
  isActive: boolean;
}

interface FacebookAccountItem {
  _id: string;
  pageName: string;
  pageId: string;
  category?: string;
  isActive: boolean;
}

export type SettingsSection = 'accounts' | 'general' | 'storage' | 'meta-guide' | 'mcp' | 'logs';

export interface SettingsLogsViewProps {
  initialSection?: SettingsSection;
}

const REFRAME_OPTIONS: SelectOption[] = [
  { value: 'blur', label: 'Blur Background (9:16 Canvas)', description: 'Fills letterboxes with blurred video reflection' },
  { value: 'pad', label: 'Color Padding (Letterbox)', description: 'Maintains aspect ratio with clean matte background' },
  { value: 'crop', label: 'Direct Center Crop', description: 'Crops center 9:16 directly without side padding' },
];

const PRESET_OPTIONS: SelectOption[] = [
  { value: 'balanced', label: 'Balanced (Recommended)', description: 'Fast encoding with excellent mobile bitrate' },
  { value: 'quality', label: 'High Fidelity (Pro)', description: 'Slower encode, maximum color retention' },
  { value: 'fast', label: 'Ultra Fast (Draft)', description: 'Optimized for rapid testing and previews' },
];

const LOG_LEVEL_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All Log Levels' },
  { value: 'info', label: 'Info Only' },
  { value: 'warn', label: 'Warnings Only' },
  { value: 'error', label: 'Errors Only' },
];

export function SettingsLogsView({ initialSection = 'accounts' }: SettingsLogsViewProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [folderInput, setFolderInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingDrive, setIsTestingDrive] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Google Drive Quota
  const [driveQuota, setDriveQuota] = useState<{
    usage?: string;
    limit?: string;
    usagePercent?: number;
    email?: string;
    displayName?: string;
  } | null>(null);

  // Connected Accounts State
  const [youtubeAccounts, setYoutubeAccounts] = useState<YouTubeAccountItem[]>([]);
  const [instagramAccounts, setInstagramAccounts] = useState<InstagramAccountItem[]>([]);
  const [threadsAccounts, setThreadsAccounts] = useState<ThreadsAccountItem[]>([]);
  const [facebookAccounts, setFacebookAccounts] = useState<FacebookAccountItem[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [syncingPlatform, setSyncingPlatform] = useState<string | null>(null);

  // Threads OAuth Settings state
  const [threadsAppId, setThreadsAppId] = useState('');
  const [threadsAppSecret, setThreadsAppSecret] = useState('');
  const [threadsRedirectUri, setThreadsRedirectUri] = useState('http://localhost:3000/auth/threads/callback');

  // Instagram OAuth Settings state
  const [instagramAppId, setInstagramAppId] = useState('');
  const [instagramAppSecret, setInstagramAppSecret] = useState('');
  const [instagramRedirectUri, setInstagramRedirectUri] = useState('http://localhost:3000/auth/instagram/callback');

  // Defaults & Limits state
  const [reframeMode, setReframeMode] = useState('blur');
  const [qualityPreset, setQualityPreset] = useState('balanced');
  const [filenameTemplate, setFilenameTemplate] = useState('{title}_part{nn}');
  const [maxUploadMb, setMaxUploadMb] = useState(2048);
  const [maxParts, setMaxParts] = useState(100);
  const [concurrency, setConcurrency] = useState(2);

  // Section 8 Log Viewer state
  const [logFiles, setLogFiles] = useState<Array<{ name: string; channel: string; sizeBytes: number }>>([]);
  const [selectedFile, setSelectedFile] = useState<string>('render.log');
  const [logEntries, setLogEntries] = useState<any[]>([]);
  const [logLevel, setLogLevel] = useState<string>('all');
  const [logSearch, setLogSearch] = useState<string>('');
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  // Storage Maintenance state
  const [storageBreakdown, setStorageBreakdown] = useState<any>(null);
  const [isCleaningStorage, setIsCleaningStorage] = useState(false);
  const [cleanResult, setCleanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [cleanOutputsOption, setCleanOutputsOption] = useState(false);

  // Notice modal state
  const [notice, setNotice] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
  }>({
    isOpen: false,
    message: '',
  });

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const { ok, data } = await safeFetchJson<{ settings: SettingsData }>(res);
      if (ok && data?.settings) {
        setSettings(data.settings);
        setFolderInput(data.settings.googleDrive?.folderId || '');
        if (data.settings.threads) {
          setThreadsAppId(data.settings.threads.appId || '');
          setThreadsRedirectUri(data.settings.threads.redirectUri || 'http://localhost:3000/auth/threads/callback');
        }
        if (data.settings.instagram) {
          setInstagramAppId(data.settings.instagram.appId || '');
          setInstagramRedirectUri(data.settings.instagram.redirectUri || 'http://localhost:3000/auth/instagram/callback');
        }
        if (data.settings.defaults) {
          setReframeMode(data.settings.defaults.reframeMode || 'blur');
          setQualityPreset(data.settings.defaults.qualityPreset || 'balanced');
          setFilenameTemplate(data.settings.defaults.filenameTemplate || '{title}_part{nn}');
        }
        if (data.settings.limits) {
          setMaxUploadMb(data.settings.limits.maxUploadSizeMb || 2048);
          setMaxParts(data.settings.limits.maxParts || 100);
          setConcurrency(data.settings.limits.concurrency || 2);
        }
      }
    } catch {
      // Non-fatal
    }
  }, []);

  const fetchDriveQuota = useCallback(async () => {
    try {
      const res = await fetch('/api/drive/quota');
      const { ok, data } = await safeFetchJson<any>(res);
      if (ok && data?.success && data?.storageQuota) {
        const usageBytes = parseInt(data.storageQuota.usage || '0', 10);
        const limitBytes = parseInt(data.storageQuota.limit || '0', 10);
        const percent = limitBytes > 0 ? Math.round((usageBytes / limitBytes) * 100) : 0;
        setDriveQuota({
          usage: formatBytes(usageBytes),
          limit: limitBytes > 0 ? formatBytes(limitBytes) : 'Unlimited',
          usagePercent: percent,
          email: data.user?.emailAddress,
          displayName: data.user?.displayName,
        });
      }
    } catch {
      // Non-fatal
    }
  }, []);

  const fetchAllAccounts = useCallback(async () => {
    setIsLoadingAccounts(true);
    try {
      const [ytRes, igRes, thRes, fbRes] = await Promise.allSettled([
        fetch('/api/youtube/accounts'),
        fetch('/api/instagram/accounts'),
        fetch('/api/threads/accounts'),
        fetch('/api/facebook/accounts'),
      ]);

      if (ytRes.status === 'fulfilled' && ytRes.value.ok) {
        const { data } = await safeFetchJson<{ accounts: YouTubeAccountItem[] }>(ytRes.value);
        if (data?.accounts) setYoutubeAccounts(data.accounts);
      }
      if (igRes.status === 'fulfilled' && igRes.value.ok) {
        const { data } = await safeFetchJson<{ accounts: InstagramAccountItem[] }>(igRes.value);
        if (data?.accounts) setInstagramAccounts(data.accounts);
      }
      if (thRes.status === 'fulfilled' && thRes.value.ok) {
        const { data } = await safeFetchJson<{ accounts: ThreadsAccountItem[] }>(thRes.value);
        if (data?.accounts) setThreadsAccounts(data.accounts);
      }
      if (fbRes.status === 'fulfilled' && fbRes.value.ok) {
        const { data } = await safeFetchJson<{ accounts: FacebookAccountItem[] }>(fbRes.value);
        if (data?.accounts) setFacebookAccounts(data.accounts);
      }
    } finally {
      setIsLoadingAccounts(false);
    }
  }, []);

  const fetchStorageStats = useCallback(async () => {
    try {
      const res = await fetch('/api/storage/clean');
      const { ok, data } = await safeFetchJson<any>(res);
      if (ok && data?.breakdown) {
        setStorageBreakdown(data.breakdown);
      }
    } catch {}
  }, []);

  const fetchLogFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/logs/files');
      const { ok, data } = await safeFetchJson<any>(res);
      if (ok && data?.files) {
        setLogFiles(data.files);
      }
    } catch {}
  }, []);

  const fetchLogEntries = useCallback(async (file: string) => {
    setIsLogsLoading(true);
    try {
      const res = await fetch(`/api/logs/files/${encodeURIComponent(file)}?limit=150&level=${logLevel}&search=${encodeURIComponent(logSearch)}`);
      const { ok, data } = await safeFetchJson<any>(res);
      if (ok && data?.logs) {
        setLogEntries(data.logs);
      }
    } finally {
      setIsLogsLoading(false);
    }
  }, [logLevel, logSearch]);

  useEffect(() => {
    fetchSettings();
    fetchAllAccounts();
    fetchDriveQuota();
    fetchStorageStats();
    fetchLogFiles();
  }, [fetchSettings, fetchAllAccounts, fetchDriveQuota, fetchStorageStats, fetchLogFiles]);

  useEffect(() => {
    if (activeSection === 'logs' && selectedFile) {
      fetchLogEntries(selectedFile);
    }
  }, [activeSection, selectedFile, fetchLogEntries]);

  // Handle Account Connects
  const handleConnectGoogleDrive = async () => {
    try {
      const res = await fetch('/api/drive/auth-url');
      const { ok, data } = await safeFetchJson<{ authUrl?: string }>(res);
      if (ok && data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setNotice({
          isOpen: true,
          title: 'Google Drive Auth Error',
          message: 'Could not generate Google authorization link. Check that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are configured in your environment.',
          type: 'error',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ isOpen: true, title: 'Network Error', message: msg, type: 'error' });
    }
  };

  const handleConnectYouTube = async () => {
    try {
      const res = await fetch('/api/youtube/auth');
      const { ok, data } = await safeFetchJson<{ url?: string }>(res);
      if (ok && data?.url) {
        window.location.href = data.url;
      } else {
        setNotice({
          isOpen: true,
          title: 'YouTube Auth Error',
          message: 'Could not generate YouTube OAuth link. Ensure Google credentials and redirect URI are configured in Google Cloud Console.',
          type: 'error',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ isOpen: true, title: 'Network Error', message: msg, type: 'error' });
    }
  };

  const handleConnectInstagram = async () => {
    try {
      const res = await fetch('/api/instagram/auth');
      const { ok, data } = await safeFetchJson<{ authUrl?: string }>(res);
      if (ok && data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setNotice({
          isOpen: true,
          title: 'Instagram Auth Error',
          message: 'Could not start Instagram OAuth flow. Enter your Meta App ID in the Meta configuration card or .env file.',
          type: 'error',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ isOpen: true, title: 'Network Error', message: msg, type: 'error' });
    }
  };

  const handleConnectThreads = async () => {
    try {
      const res = await fetch('/api/threads/auth');
      const { ok, data } = await safeFetchJson<{ authUrl?: string }>(res);
      if (ok && data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setNotice({
          isOpen: true,
          title: 'Threads Auth Error',
          message: 'Could not start Threads OAuth flow. Enter your Meta Threads App ID in the Meta configuration card or .env file.',
          type: 'error',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ isOpen: true, title: 'Network Error', message: msg, type: 'error' });
    }
  };

  const handleConnectFacebook = async () => {
    try {
      const res = await fetch('/api/facebook/auth');
      const { ok, data } = await safeFetchJson<{ authUrl?: string }>(res);
      if (ok && data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setNotice({
          isOpen: true,
          title: 'Facebook Auth Error',
          message: 'Could not start Facebook Page OAuth flow. Ensure FACEBOOK_APP_ID is configured.',
          type: 'error',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ isOpen: true, title: 'Network Error', message: msg, type: 'error' });
    }
  };

  // Sync Live Data Callers
  const handleSyncYouTube = async (channelId?: string) => {
    setSyncingPlatform('youtube');
    try {
      const res = await fetch('/api/youtube/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId }),
      });
      const { ok, data } = await safeFetchJson<any>(res);
      if (ok && data?.success) {
        setNotice({
          isOpen: true,
          title: 'YouTube Sync Complete',
          message: data.message || `Synchronized ${data.syncedVideos || 0} videos with live statistics from YouTube Data API!`,
          type: 'success',
        });
        fetchAllAccounts();
      } else {
        setNotice({
          isOpen: true,
          title: 'YouTube Sync Notice',
          message: data?.error || 'Could not synchronize YouTube channel data.',
          type: 'error',
        });
      }
    } finally {
      setSyncingPlatform(null);
    }
  };

  const handleSyncInstagram = async () => {
    setSyncingPlatform('instagram');
    try {
      const res = await fetch('/api/instagram/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const { ok, data } = await safeFetchJson<any>(res);
      if (ok && data?.success) {
        setNotice({
          isOpen: true,
          title: 'Instagram Sync Complete',
          message: `Synchronized live Reels insights for connected creator account!`,
          type: 'success',
        });
        fetchAllAccounts();
      } else {
        setNotice({
          isOpen: true,
          title: 'Instagram Sync Notice',
          message: data?.error || 'Could not synchronize Instagram metrics.',
          type: 'error',
        });
      }
    } finally {
      setSyncingPlatform(null);
    }
  };

  const handleSyncThreads = async () => {
    setSyncingPlatform('threads');
    try {
      const res = await fetch('/api/threads/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const { ok, data } = await safeFetchJson<any>(res);
      if (ok && data?.success) {
        setNotice({
          isOpen: true,
          title: 'Threads Sync Complete',
          message: `Synchronized live views, likes, and reply metrics from Threads API!`,
          type: 'success',
        });
        fetchAllAccounts();
      } else {
        setNotice({
          isOpen: true,
          title: 'Threads Sync Notice',
          message: data?.error || 'Could not synchronize Threads metrics.',
          type: 'error',
        });
      }
    } finally {
      setSyncingPlatform(null);
    }
  };

  const handleSyncFacebook = async () => {
    setSyncingPlatform('facebook');
    try {
      const res = await fetch('/api/facebook/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const { ok, data } = await safeFetchJson<any>(res);
      if (ok && data?.success) {
        setNotice({
          isOpen: true,
          title: 'Facebook Sync Complete',
          message: `Synchronized connected Facebook Pages and video insights!`,
          type: 'success',
        });
        fetchAllAccounts();
      } else {
        setNotice({
          isOpen: true,
          title: 'Facebook Sync Notice',
          message: data?.error || 'Could not synchronize Facebook Pages.',
          type: 'error',
        });
      }
    } finally {
      setSyncingPlatform(null);
    }
  };

  // Delete Account Handlers
  const handleDeleteYouTubeAccount = async (channelId: string) => {
    try {
      const res = await fetch(`/api/youtube/accounts?channelId=${encodeURIComponent(channelId)}`, {
        method: 'DELETE',
      });
      const { ok } = await safeFetchJson(res);
      if (ok) {
        fetchAllAccounts();
      }
    } catch {}
  };

  const handleDeleteInstagramAccount = async (id: string) => {
    try {
      const res = await fetch(`/api/instagram/accounts/${id}`, { method: 'DELETE' });
      const { ok } = await safeFetchJson(res);
      if (ok) {
        fetchAllAccounts();
      }
    } catch {}
  };

  const handleDeleteThreadsAccount = async (id: string) => {
    try {
      const res = await fetch(`/api/threads/accounts/${id}`, { method: 'DELETE' });
      const { ok } = await safeFetchJson(res);
      if (ok) {
        fetchAllAccounts();
      }
    } catch {}
  };

  // Drive test
  const handleTestDrive = async () => {
    setIsTestingDrive(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/drive/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: folderInput.trim() }),
      });
      const { ok, data } = await safeFetchJson<any>(res);
      if (ok && data?.success) {
        setTestResult({
          success: true,
          message: `Write access verified successfully! Folder: "${data.folderName || 'Selected Folder'}"`,
        });
        fetchDriveQuota();
        fetchSettings();
      } else {
        setTestResult({
          success: false,
          message: data?.error || 'Failed to verify Google Drive folder access.',
        });
      }
    } finally {
      setIsTestingDrive(false);
    }
  };

  // Storage Cleanup
  const handleCleanStorage = async () => {
    try {
      setIsCleaningStorage(true);
      setCleanResult(null);
      const res = await fetch('/api/storage/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cleanSessions: true,
          cleanWork: true,
          cleanUploads: true,
          cleanOutputs: cleanOutputsOption,
        }),
      });
      const { ok, data } = await safeFetchJson<any>(res);
      if (ok && data?.success) {
        setCleanResult({
          success: true,
          message: `Storage cleaned! Purged ${data.deletedFilesCount || 0} orphaned files (${formatBytes(data.freedBytes || 0)} freed).`,
        });
        fetchStorageStats();
      } else {
        setCleanResult({
          success: false,
          message: data?.error || 'Failed to clean storage.',
        });
      }
    } finally {
      setIsCleaningStorage(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const payload: any = {
        googleDrive: {
          folderId: folderInput.trim(),
        },
        threads: {
          appId: threadsAppId.trim(),
          appSecret: threadsAppSecret.trim(),
          redirectUri: threadsRedirectUri.trim(),
        },
        instagram: {
          appId: instagramAppId.trim(),
          appSecret: instagramAppSecret.trim(),
          redirectUri: instagramRedirectUri.trim(),
        },
        defaults: {
          reframeMode,
          qualityPreset,
          filenameTemplate: filenameTemplate.trim(),
        },
        limits: {
          maxUploadSizeMb: Number(maxUploadMb),
          maxParts: Number(maxParts),
          concurrency: Number(concurrency),
        },
      };

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const { ok, data } = await safeFetchJson<any>(res);
      if (ok && data?.success) {
        setNotice({
          isOpen: true,
          title: 'Settings Saved',
          message: 'System settings, platform credentials, and engine limits updated successfully.',
          type: 'success',
        });
        fetchSettings();
      } else {
        setNotice({
          isOpen: true,
          title: 'Save Failed',
          message: data?.error || 'Failed to update system settings.',
          type: 'error',
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner & Hub Navigation */}
      <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col gap-5 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-400" />
              Settings, Multi-Channel Accounts &amp; Diagnostics Hub
            </h2>
            <p className="text-xs text-slate-400">
              Configure Google Drive, manage connected social channels, adjust video render engine parameters, and inspect live system logs.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              {isSaving ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Configuration</span>
            </button>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-2 border-t border-slate-800/80 pt-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSection('accounts')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSection === 'accounts'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Connected Accounts &amp; Drive</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('general')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSection === 'general'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Engine Defaults &amp; Limits</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('storage')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSection === 'storage'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/25'
                : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Storage &amp; Cache</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('meta-guide')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSection === 'meta-guide'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Meta Setup Guide</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('mcp')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSection === 'mcp'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>MCP Server &amp; API</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('logs')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSection === 'logs'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>System Logs</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: CONNECTED ACCOUNTS & DRIVE (PRIMARY HUB) */}
      {activeSection === 'accounts' && (
        <div className="flex flex-col gap-6">
          {/* Google Drive Primary Card */}
          <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col gap-5 backdrop-blur-md">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <FolderSync className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Google Drive Storage (v3)</h3>
                  <p className="text-[11px] text-slate-400">Target cloud destination for segmented video parts and mobile clips</p>
                </div>
              </div>

              {settings?.googleDrive?.connected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Not Connected / Token Expired
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Drive Auth & Quota */}
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Authorized Account</span>
                    <span className="text-xs font-mono text-slate-200">
                      {driveQuota?.email || settings?.googleDrive?.userEmail || 'Not signed in'}
                    </span>
                  </div>

                  {driveQuota && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Drive Storage Quota</span>
                        <span className="text-slate-300 font-mono">
                          {driveQuota.usage} / {driveQuota.limit} ({driveQuota.usagePercent}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full"
                          style={{ width: `${Math.min(driveQuota.usagePercent || 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleConnectGoogleDrive}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/20 transition-all"
                  >
                    <FolderSync className="w-4 h-4" />
                    <span>{settings?.googleDrive?.connected ? 'Reconnect Google Account' : 'Connect Google Drive'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={fetchDriveQuota}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                    title="Refresh Quota"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Right Column: Target Folder ID & Verification */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-300">Target Folder ID or Shared URL</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={folderInput}
                      onChange={(e) => setFolderInput(e.target.value)}
                      placeholder="e.g. 1sHGaq08RbnPyD_xgkEN6RaNzwYsGLEjk"
                      className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleTestDrive}
                      disabled={isTestingDrive}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition-all disabled:opacity-50 whitespace-nowrap"
                    >
                      {isTestingDrive ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      <span>Test Write Access</span>
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Leave empty for root folder, or paste a Drive folder link directly from your browser.
                  </span>
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      testResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}
                  >
                    {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Social Channels 4-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CARD 1: YOUTUBE STUDIO */}
            <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col gap-4 backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                    <Youtube className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">YouTube Channels</h3>
                    <p className="text-[11px] text-slate-400">Shorts publishing &amp; live view analytics</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSyncYouTube()}
                    disabled={syncingPlatform === 'youtube' || youtubeAccounts.length === 0}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all disabled:opacity-40"
                    title="Sync Channel Data"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingPlatform === 'youtube' ? 'animate-spin text-rose-400' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={handleConnectYouTube}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/20"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Channel</span>
                  </button>
                </div>
              </div>

              {youtubeAccounts.length === 0 ? (
                <div className="p-5 rounded-xl bg-slate-950/50 border border-slate-800/80 text-center flex flex-col items-center gap-2">
                  <Youtube className="w-7 h-7 text-slate-600" />
                  <p className="text-xs text-slate-400">No YouTube channels connected in this database.</p>
                  <button
                    type="button"
                    onClick={handleConnectYouTube}
                    className="text-xs font-semibold text-rose-400 hover:underline"
                  >
                    Connect YouTube Account
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {youtubeAccounts.map((yt) => (
                    <div
                      key={yt.channelId}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {yt.channelAvatarUrl ? (
                          <img src={yt.channelAvatarUrl} alt="" className="w-8 h-8 rounded-full border border-slate-700" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                            <Youtube className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <h4 className="text-xs font-bold text-white">{yt.channelTitle}</h4>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {yt.subscriberCount ? `${yt.subscriberCount.toLocaleString()} subscribers` : '0 subscribers'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {yt.isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                            Active
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteYouTubeAccount(yt.channelId)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-all"
                          title="Remove Channel"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CARD 2: INSTAGRAM REELS */}
            <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col gap-4 backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                    <Instagram className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Instagram Reels</h3>
                    <p className="text-[11px] text-slate-400">Reels composer &amp; live play analytics</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncInstagram}
                    disabled={syncingPlatform === 'instagram' || instagramAccounts.length === 0}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all disabled:opacity-40"
                    title="Sync Live Analytics"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingPlatform === 'instagram' ? 'animate-spin text-pink-400' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={handleConnectInstagram}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-pink-600 hover:bg-pink-500 text-white transition-all shadow-md shadow-pink-600/20"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Account</span>
                  </button>
                </div>
              </div>

              {instagramAccounts.length === 0 ? (
                <div className="p-5 rounded-xl bg-slate-950/50 border border-slate-800/80 text-center flex flex-col items-center gap-2">
                  <Instagram className="w-7 h-7 text-slate-600" />
                  <p className="text-xs text-slate-400">No Instagram accounts connected in this database.</p>
                  <button
                    type="button"
                    onClick={handleConnectInstagram}
                    className="text-xs font-semibold text-pink-400 hover:underline"
                  >
                    Connect Instagram Account
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {instagramAccounts.map((ig) => (
                    <div
                      key={ig._id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {ig.profilePictureUrl ? (
                          <img src={ig.profilePictureUrl} alt="" className="w-8 h-8 rounded-full border border-slate-700" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                            <Instagram className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <h4 className="text-xs font-bold text-white">@{ig.username}</h4>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {ig.followerCount ? `${ig.followerCount.toLocaleString()} followers` : '0 followers'} &bull; {ig.mediaCount || 0} posts
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {ig.isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                            Active
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteInstagramAccount(ig._id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-all"
                          title="Remove Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CARD 3: THREADS STUDIO */}
            <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col gap-4 backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <AtSign className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Threads Accounts</h3>
                    <p className="text-[11px] text-slate-400">Text threads, video posts &amp; engagement</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncThreads}
                    disabled={syncingPlatform === 'threads' || threadsAccounts.length === 0}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all disabled:opacity-40"
                    title="Sync Threads Analytics"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingPlatform === 'threads' ? 'animate-spin text-purple-400' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={handleConnectThreads}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md shadow-purple-600/20"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Account</span>
                  </button>
                </div>
              </div>

              {threadsAccounts.length === 0 ? (
                <div className="p-5 rounded-xl bg-slate-950/50 border border-slate-800/80 text-center flex flex-col items-center gap-2">
                  <AtSign className="w-7 h-7 text-slate-600" />
                  <p className="text-xs text-slate-400">No Threads accounts connected in this database.</p>
                  <button
                    type="button"
                    onClick={handleConnectThreads}
                    className="text-xs font-semibold text-purple-400 hover:underline"
                  >
                    Connect Threads Account
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {threadsAccounts.map((th) => (
                    <div
                      key={th._id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {th.profilePictureUrl ? (
                          <img src={th.profilePictureUrl} alt="" className="w-8 h-8 rounded-full border border-slate-700" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                            <AtSign className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <h4 className="text-xs font-bold text-white">@{th.username}</h4>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {th.followerCount ? `${th.followerCount.toLocaleString()} followers` : '0 followers'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {th.isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                            Active
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteThreadsAccount(th._id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-all"
                          title="Remove Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CARD 4: FACEBOOK PAGES */}
            <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col gap-4 backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Facebook className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Facebook Pages</h3>
                    <p className="text-[11px] text-slate-400">Page videos, scheduled posts &amp; reach</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncFacebook}
                    disabled={syncingPlatform === 'facebook' || facebookAccounts.length === 0}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all disabled:opacity-40"
                    title="Sync Pages"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingPlatform === 'facebook' ? 'animate-spin text-blue-400' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={handleConnectFacebook}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/20"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Page</span>
                  </button>
                </div>
              </div>

              {facebookAccounts.length === 0 ? (
                <div className="p-5 rounded-xl bg-slate-950/50 border border-slate-800/80 text-center flex flex-col items-center gap-2">
                  <Facebook className="w-7 h-7 text-slate-600" />
                  <p className="text-xs text-slate-400">No Facebook Pages connected in this database.</p>
                  <button
                    type="button"
                    onClick={handleConnectFacebook}
                    className="text-xs font-semibold text-blue-400 hover:underline"
                  >
                    Connect Facebook Page
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {facebookAccounts.map((fb) => (
                    <div
                      key={fb._id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-white">{fb.pageName}</h4>
                        <p className="text-[10px] text-slate-400 font-mono">
                          ID: {fb.pageId} {fb.category ? `&bull; ${fb.category}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {fb.isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: ENGINE DEFAULTS & LIMITS */}
      {activeSection === 'general' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Engine Defaults */}
          <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col gap-5 backdrop-blur-md">
            <div className="pb-3 border-b border-slate-800 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Video Reframe &amp; Quality Defaults</h3>
                <p className="text-[11px] text-slate-400">Applied automatically when splitting new jobs</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-300">Default Reframe Mode</label>
                <CustomSelect
                  options={REFRAME_OPTIONS}
                  value={reframeMode}
                  onChange={setReframeMode}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-300">Default Quality Preset</label>
                <CustomSelect
                  options={PRESET_OPTIONS}
                  value={qualityPreset}
                  onChange={setQualityPreset}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-300">Filename Template</label>
                <input
                  type="text"
                  value={filenameTemplate}
                  onChange={(e) => setFilenameTemplate(e.target.value)}
                  placeholder="{title}_part{nn}"
                  className="bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono transition-all"
                />
                <span className="text-[11px] text-slate-500">
                  Supported tokens: {'{title}'}, {'{nn}'} (padded part number), {'{total}'}.
                </span>
              </div>
            </div>
          </div>

          {/* Engine Processing Limits */}
          <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col gap-5 backdrop-blur-md">
            <div className="pb-3 border-b border-slate-800 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Hardware Limits &amp; Concurrency</h3>
                <p className="text-[11px] text-slate-400">Throttle render workloads to preserve CPU and RAM</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-300">Max Upload Size (MB)</label>
                <input
                  type="number"
                  value={maxUploadMb}
                  onChange={(e) => setMaxUploadMb(Number(e.target.value))}
                  min={100}
                  max={100000}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-300">Max Split Parts per Video</label>
                <input
                  type="number"
                  value={maxParts}
                  onChange={(e) => setMaxParts(Number(e.target.value))}
                  min={1}
                  max={1000}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-300">Concurrent FFmpeg Workers</label>
                <input
                  type="number"
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                  min={1}
                  max={8}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono transition-all"
                />
                <span className="text-[11px] text-slate-500">
                  Recommended: 2 on Apple Silicon laptops, 4 on desktop workstations.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: STORAGE & CACHE MAINTENANCE */}
      {activeSection === 'storage' && (
        <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col gap-6 backdrop-blur-md">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Storage &amp; Temporary Cache Maintenance</h3>
                <p className="text-[11px] text-slate-400">Purge orphaned chunk slices, intermediate FFmpeg workdirs, and cached uploads</p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchStorageStats}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
              title="Refresh Storage Stats"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {storageBreakdown ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1">
                <span className="text-[11px] text-slate-400">Upload Sessions</span>
                <span className="text-base font-bold text-white font-mono">{storageBreakdown.uploadSessions || '0 B'}</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1">
                <span className="text-[11px] text-slate-400">Source Cache</span>
                <span className="text-base font-bold text-white font-mono">{storageBreakdown.uploadedSourceCache || '0 B'}</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1">
                <span className="text-[11px] text-slate-400">Render Work Dirs</span>
                <span className="text-base font-bold text-white font-mono">{storageBreakdown.renderingWorkDirs || '0 B'}</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1">
                <span className="text-[11px] text-slate-400">Rendered Outputs</span>
                <span className="text-base font-bold text-white font-mono">{storageBreakdown.renderedOutputs || '0 B'}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500">Scanning local disk storage...</div>
          )}

          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={cleanOutputsOption}
                onChange={(e) => setCleanOutputsOption(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
              />
              <span>Also purge completed render outputs (deletes rendered segments from disk)</span>
            </label>

            <button
              type="button"
              onClick={handleCleanStorage}
              disabled={isCleaningStorage}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-all disabled:opacity-50"
            >
              {isCleaningStorage ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>Purge Temporary Files</span>
            </button>
          </div>

          {cleanResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                cleanResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}
            >
              {cleanResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{cleanResult.message}</span>
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: META SETUP GUIDE */}
      {activeSection === 'meta-guide' && <MetaConnectionGuideView />}

      {/* SECTION 5: MCP SERVER & API BRIDGE */}
      {activeSection === 'mcp' && <McpServerDocsView />}

      {/* SECTION 6: SYSTEM DIAGNOSTIC LOGS */}
      {activeSection === 'logs' && (
        <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col gap-4 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">System Logs Viewer</h3>
                <p className="text-[11px] text-slate-400">Real-time log stream from worker, render, and API services</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-36">
                <CustomSelect
                  options={LOG_LEVEL_OPTIONS}
                  value={logLevel}
                  onChange={setLogLevel}
                />
              </div>
              <button
                type="button"
                onClick={() => selectedFile && fetchLogEntries(selectedFile)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                title="Refresh Logs"
              >
                <RotateCw className={`w-4 h-4 ${isLogsLoading ? 'animate-spin text-indigo-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Log File Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {logFiles.map((file) => (
              <button
                key={file.name}
                type="button"
                onClick={() => setSelectedFile(file.name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                  selectedFile === file.name
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-950/80 hover:bg-slate-800 text-slate-400 border border-slate-800'
                }`}
              >
                {file.name}
              </button>
            ))}
          </div>

          {/* Log Search Filter */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Filter log messages..."
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-mono"
            />
          </div>

          {/* Terminal Log Console */}
          <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/90 font-mono text-xs overflow-y-auto max-h-[480px] flex flex-col gap-1">
            {isLogsLoading && (
              <div className="text-slate-500 flex items-center gap-2 py-4 justify-center">
                <RotateCw className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Reading log buffer...</span>
              </div>
            )}

            {!isLogsLoading && logEntries.length === 0 && (
              <div className="text-slate-500 text-center py-8">No log entries found matching filter.</div>
            )}

            {!isLogsLoading &&
              logEntries.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2.5 py-0.5 hover:bg-slate-900/60 rounded px-1.5 transition-colors">
                  <span className="text-slate-500 text-[10px] whitespace-nowrap shrink-0">
                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '--:--:--'}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 rounded uppercase font-semibold shrink-0 ${
                      log.level === 'error'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : log.level === 'warn'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {log.level || 'info'}
                  </span>
                  <span className="text-slate-300 break-all leading-relaxed">
                    {log.message || JSON.stringify(log)}
                  </span>
                </div>
              ))}
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
