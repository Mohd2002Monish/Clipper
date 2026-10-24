'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { CustomSelect } from './ui/CustomSelect';
import { NoticeModal } from './ui/NoticeModal';

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

export function SettingsLogsView() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [folderInput, setFolderInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingDrive, setIsTestingDrive] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

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
  const [maxParts, setMaxParts] = useState(10000);
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
  // Notice modal state replacing alert()
  const [notice, setNotice] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
  }>({
    isOpen: false,
    message: '',
  });

  const fetchStorageStats = async () => {
    try {
      const res = await fetch('/api/storage/clean');
      if (res.ok) {
        const data = await res.json();
        setStorageBreakdown(data.breakdown);
      }
    } catch {}
  };

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
      const data = await res.json();
      if (res.ok) {
        setCleanResult({ success: true, message: data.message });
        await fetchStorageStats();
      } else {
        setCleanResult({ success: false, message: data.error || 'Failed to clean storage.' });
      }
    } catch (err: unknown) {
      setCleanResult({ success: false, message: err instanceof Error ? err.message : 'Error cleaning storage.' });
    } finally {
      setIsCleaningStorage(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setFolderInput(data.settings?.googleDrive?.folderId || '');
        setReframeMode(data.settings?.defaults?.reframeMode || 'blur');
        setQualityPreset(data.settings?.defaults?.qualityPreset || 'balanced');
        setFilenameTemplate(data.settings?.defaults?.filenameTemplate || '{title}_part{nn}');
        setMaxUploadMb(data.settings?.limits?.maxUploadSizeMb || 2048);
        setMaxParts(data.settings?.limits?.maxParts || 10000);
        setConcurrency(data.settings?.limits?.concurrency || 2);
        if (data.settings?.threads) {
          setThreadsAppId(data.settings.threads.appId || '');
          setThreadsAppSecret(data.settings.threads.appSecret || '');
          setThreadsRedirectUri(data.settings.threads.redirectUri || 'http://localhost:3000/auth/threads/callback');
        }
        if (data.settings?.instagram) {
          setInstagramAppId(data.settings.instagram.appId || '');
          setInstagramAppSecret(data.settings.instagram.appSecret || '');
          setInstagramRedirectUri(data.settings.instagram.redirectUri || 'http://localhost:3000/auth/instagram/callback');
        }
      }
    } catch {
      // Ignore
    }
  };

  const fetchLogFiles = async () => {
    try {
      const res = await fetch('/api/logs/files');
      if (res.ok) {
        const data = await res.json();
        setLogFiles(data.files || []);
        if (data.files?.length > 0 && !selectedFile) {
          setSelectedFile(data.files[0].name);
        }
      }
    } catch {
      // Ignore
    }
  };

  const fetchLogEntries = async () => {
    if (!selectedFile) return;
    try {
      setIsLogsLoading(true);
      const query = new URLSearchParams({
        limit: '200',
        level: logLevel,
        search: logSearch,
      });
      const res = await fetch(`/api/logs/files/${selectedFile}?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogEntries(data.logs || []);
      }
    } catch {
      // Ignore
    } finally {
      setIsLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchLogFiles();
    fetchStorageStats();
  }, []);

  useEffect(() => {
    fetchLogEntries();
  }, [selectedFile, logLevel, logSearch]);

  const handleConnectOAuth = async () => {
    try {
      const res = await fetch('/api/drive/auth-url');
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setNotice({
          isOpen: true,
          message: data.error || 'Failed to generate OAuth URL. Check client credentials in .env.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setNotice({
        isOpen: true,
        message: `Error starting OAuth: ${err.message}`,
        type: 'error',
      });
    }
  };

  const handleTestConnection = async () => {
    // Extract folder ID if full URL pasted
    let folderIdToTest = folderInput.trim();
    const urlMatch = folderIdToTest.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) {
      folderIdToTest = urlMatch[1];
      setFolderInput(folderIdToTest);
    }

    try {
      setIsTestingDrive(true);
      setTestResult(null);
      const res = await fetch('/api/drive/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: folderIdToTest }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: `Connection successful! Verified write access to folder "${data.folderName}" (${data.folderId}).`,
        });
        fetchSettings();
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Failed to verify folder write access.',
        });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setIsTestingDrive(false);
    }
  };

  const handleSaveSettings = async () => {
    let folderIdToSave = folderInput.trim();
    const urlMatch = folderIdToSave.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) {
      folderIdToSave = urlMatch[1];
      setFolderInput(folderIdToSave);
    }

    try {
      setIsSaving(true);
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleDrive: {
            folderId: folderIdToSave,
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
            filenameTemplate,
          },
          limits: {
            maxUploadSizeMb: maxUploadMb,
            maxParts,
            concurrency,
          },
        }),
      });
      if (res.ok) {
        setNotice({
          isOpen: true,
          message: 'Settings saved successfully!',
          type: 'success',
        });
        fetchSettings();
      }
    } catch {
      setNotice({
        isOpen: true,
        message: 'Failed to save settings.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#90CAF9] shadow-sm">
        <h2 className="text-lg font-bold text-[#0D47A1] mb-1 flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#2196F3]" />
          Settings & Section 8 Diagnostics
        </h2>
        <p className="text-xs text-slate-500">
          Configure Google Drive OAuth / Service Account destination, rendering limits, and inspect real-time JSON Lines system logs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Google Drive & System Settings */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Card 1: Google Drive */}
          <div className="bg-white rounded-2xl p-6 border border-[#90CAF9] shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#90CAF9]/40">
              <h3 className="text-sm font-bold text-[#0D47A1] flex items-center gap-2">
                <FolderSync className="w-4 h-4 text-[#2196F3]" />
                Google Drive Storage (v3)
              </h3>
              {settings?.googleDrive?.connected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  Local Fallback Only
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500">
              Connect your Google Drive account using OAuth 2.0 to automatically upload all rendered parts to a designated folder.
            </p>

            {settings?.googleDrive?.userEmail && (
              <div className="bg-[#E3F2FD]/50 p-3 rounded-xl border border-[#90CAF9]/60 text-xs flex justify-between">
                <span className="text-slate-600">Account:</span>
                <span className="text-[#0D47A1] font-semibold">{settings.googleDrive.userEmail}</span>
              </div>
            )}

            <button
              onClick={handleConnectOAuth}
              className="btn-pressable flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#2196F3] hover:bg-[#1976D2] text-white text-xs font-semibold shadow-md shadow-[#2196F3]/25 transition-all"
            >
              <FolderSync className="w-3.5 h-3.5" />
              {settings?.googleDrive?.connected ? 'Reconnect Account' : 'Connect Google Drive Account'}
            </button>

            {/* Folder ID input */}
            <div className="pt-3 border-t border-[#90CAF9]/40 flex flex-col gap-2">
              <label className="text-xs font-semibold text-[#0D47A1]">
                Target Folder ID or Shared URL
              </label>
              <input
                type="text"
                value={folderInput}
                onChange={(e) => setFolderInput(e.target.value)}
                placeholder="e.g. 1A2b3C... or full drive.google.com folder URL"
                className="bg-[#E3F2FD]/30 border border-[#90CAF9] rounded-xl px-3 py-2 text-xs text-[#0D47A1] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2196F3] font-mono"
              />
              <p className="text-[10px] text-slate-500">
                Leave empty for root folder, or paste the folder link directly from your browser.
              </p>

              <button
                disabled={isTestingDrive}
                onClick={handleTestConnection}
                className="btn-pressable flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E3F2FD] hover:bg-[#90CAF9]/40 text-[#0D47A1] border border-[#90CAF9] text-xs font-semibold transition-all disabled:opacity-50"
              >
                <ShieldCheck className={`w-3.5 h-3.5 ${isTestingDrive ? 'animate-spin' : 'text-emerald-600'}`} />
                {isTestingDrive ? 'Testing...' : 'Test Connection & Write Access'}
              </button>

              {testResult && (
                <div
                  className={`p-3 rounded-xl text-xs flex flex-col gap-2 border ${
                    testResult.success
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    )}
                    <span className="break-words">{testResult.message}</span>
                  </div>

                  {testResult.message.includes('console.developers.google.com') && (
                    <a
                      href="https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=199434296170"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2196F3] hover:bg-[#1976D2] text-white text-xs font-semibold shadow-sm w-fit transition-all ml-6"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Enable Google Drive API</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card 1.5: Meta Threads OAuth Configuration */}
          <div className="bg-white rounded-2xl p-6 border border-purple-200 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-purple-100">
              <h3 className="text-sm font-bold text-purple-950 flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-600" />
                Meta Threads Integration (OAuth 2.0)
              </h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  threadsAppId
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300/60'
                    : 'bg-amber-100 text-amber-800 border border-amber-300/60'
                }`}
              >
                {threadsAppId ? 'Configured' : 'Setup Required'}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Configure your Meta Developer App to authorize and publish across multiple Threads creator accounts without third-party services.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-600 font-semibold block mb-1 uppercase text-[10px]">Meta Threads App ID</label>
                <input
                  type="text"
                  value={threadsAppId}
                  onChange={(e) => setThreadsAppId(e.target.value)}
                  placeholder="e.g. 104829104928"
                  className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-purple-500 bg-white"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1 uppercase text-[10px]">Meta Threads App Secret</label>
                <input
                  type="password"
                  value={threadsAppSecret}
                  onChange={(e) => setThreadsAppSecret(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-purple-500 bg-white"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="text-slate-600 font-semibold block mb-1 uppercase text-[10px]">Redirect Callback URI</label>
              <input
                type="text"
                value={threadsRedirectUri}
                onChange={(e) => setThreadsRedirectUri(e.target.value)}
                className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-purple-500 bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Must match the Redirect URI entered in your Meta Developer App Settings.
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <a
                href="https://developers.facebook.com/apps/"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                Meta Developer Portal <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href="/?tab=threads-composer"
                className="text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
              >
                <span>Open Threads Studio</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Card: Instagram Meta Graph API OAuth */}
          <div className="bg-white rounded-2xl p-6 border border-pink-200 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-pink-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Instagram className="w-4 h-4 text-pink-500" />
                Meta Instagram Reels Integration
              </h3>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  instagramAppId
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {instagramAppId ? 'Configured' : 'Setup Required'}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Configure your Meta Developer App to authorize and publish Reels, track video view analytics, and auto-comment CTAs across multiple Instagram creator accounts.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-600 font-semibold block mb-1 uppercase text-[10px]">Meta Instagram App ID</label>
                <input
                  type="text"
                  value={instagramAppId}
                  onChange={(e) => setInstagramAppId(e.target.value)}
                  placeholder="e.g. 104829104928"
                  className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-pink-500 bg-white"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1 uppercase text-[10px]">Meta Instagram App Secret</label>
                <input
                  type="password"
                  value={instagramAppSecret}
                  onChange={(e) => setInstagramAppSecret(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-pink-500 bg-white"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="text-slate-600 font-semibold block mb-1 uppercase text-[10px]">Redirect Callback URI</label>
              <input
                type="text"
                value={instagramRedirectUri}
                onChange={(e) => setInstagramRedirectUri(e.target.value)}
                className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-pink-500 bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Must match the Redirect URI entered in your Meta Developer App Instagram Basic Display / Graph API settings.
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <a
                href="https://developers.facebook.com/apps/"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-pink-600 hover:text-pink-700 flex items-center gap-1"
              >
                Meta Developer Portal <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href="/?tab=instagram-composer"
                className="text-xs font-bold text-pink-700 bg-pink-50 hover:bg-pink-100 border border-pink-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
              >
                <span>Open Instagram Studio</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Card 2: Defaults & Limits */}
          <div className="bg-white rounded-2xl p-6 border border-[#90CAF9] shadow-sm flex flex-col gap-4">
            <h3 className="text-sm font-bold text-[#0D47A1] flex items-center gap-2 pb-3 border-b border-[#90CAF9]/40">
              <Cpu className="w-4 h-4 text-[#2196F3]" />
              Engine Limits & Defaults
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-600 font-medium block mb-1">Default Preset</label>
                <CustomSelect
                  value={qualityPreset}
                  onChange={(val) => setQualityPreset(val)}
                  size="sm"
                  options={[
                    { value: 'fast', label: 'Fast (Lower CPU)' },
                    { value: 'balanced', label: 'Balanced (Recommended)' },
                    { value: 'high', label: 'High Quality' },
                  ]}
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">Default Reframe</label>
                <CustomSelect
                  value={reframeMode}
                  onChange={(val) => setReframeMode(val)}
                  size="sm"
                  options={[
                    { value: 'blur', label: 'Blur Background (Fit)' },
                    { value: 'solid', label: 'Solid Letterbox' },
                    { value: 'crop', label: 'Crop to Fill' },
                  ]}
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">Max Upload (MB)</label>
                <input
                  type="number"
                  value={maxUploadMb}
                  onChange={(e) => setMaxUploadMb(Number(e.target.value))}
                  className="w-full bg-[#E3F2FD]/30 border border-[#90CAF9] rounded-xl px-2.5 py-1.5 text-xs text-[#0D47A1] font-mono focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">Concurrency</label>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                  className="w-full bg-[#E3F2FD]/30 border border-[#90CAF9] rounded-xl px-2.5 py-1.5 text-xs text-[#0D47A1] font-mono focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-600 font-medium block mb-1">Default Filename Template</label>
              <input
                type="text"
                value={filenameTemplate}
                onChange={(e) => setFilenameTemplate(e.target.value)}
                className="w-full bg-[#E3F2FD]/30 border border-[#90CAF9] rounded-xl px-3 py-1.5 text-xs text-[#0D47A1] font-mono focus:outline-none focus:ring-2 focus:ring-[#2196F3]"
              />
            </div>

            <button
              disabled={isSaving}
              onClick={handleSaveSettings}
              className="btn-pressable flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2196F3] hover:bg-[#1976D2] text-white text-xs font-semibold shadow-md shadow-[#2196F3]/25 transition-all mt-2"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Save System Settings'}
            </button>
          </div>

          {/* Card 3: Storage & Cache Maintenance */}
          <div className="bg-white rounded-2xl p-6 border border-[#90CAF9] shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#90CAF9]/40">
              <h3 className="text-sm font-bold text-[#0D47A1] flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-[#2196F3]" />
                Storage & Cache Maintenance
              </h3>
              <button
                onClick={fetchStorageStats}
                title="Refresh storage breakdown"
                className="p-1 rounded-lg hover:bg-[#E3F2FD] text-slate-500 hover:text-[#0D47A1] transition-all"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Purge temporary upload chunk slices, intermediate render files, and orphaned upload caches.
            </p>

            {/* Storage breakdown table */}
            <div className="bg-[#E3F2FD]/40 p-3.5 rounded-xl border border-[#90CAF9]/60 flex flex-col gap-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>Upload Chunk Sessions:</span>
                <span className="text-[#0D47A1] font-mono font-semibold">{storageBreakdown?.sessionsFormatted || '0 B'}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Uploaded Source Cache:</span>
                <span className="text-[#0D47A1] font-mono font-semibold">{storageBreakdown?.uploadsFormatted || '0 B'}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Rendering Work Dirs:</span>
                <span className="text-[#0D47A1] font-mono font-semibold">{storageBreakdown?.workFormatted || '0 B'}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Rendered Outputs:</span>
                <span className="text-[#0D47A1] font-mono font-semibold">{storageBreakdown?.outputsFormatted || '0 B'}</span>
              </div>
              <div className="pt-2 border-t border-[#90CAF9] flex justify-between items-center font-bold text-[#0D47A1]">
                <span>Total Cleanable:</span>
                <span className="font-mono text-[#2196F3]">{storageBreakdown?.totalFormatted || '0 B'}</span>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={cleanOutputsOption}
                onChange={(e) => setCleanOutputsOption(e.target.checked)}
                className="rounded border-[#90CAF9] text-[#2196F3] focus:ring-0"
              />
              <span>Also delete finished output video files</span>
            </label>

            <button
              disabled={isCleaningStorage}
              onClick={() => handleCleanStorage()}
              className="btn-pressable flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              <Trash2 className={`w-3.5 h-3.5 ${isCleaningStorage ? 'animate-spin' : ''}`} />
              <span>{isCleaningStorage ? 'Purging Storage...' : 'Clean Storage & Temp Files'}</span>
            </button>

            {cleanResult && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                  cleanResult.success
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {cleanResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                )}
                <span>{cleanResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Section 8 Interactive Log Viewer */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white rounded-2xl p-6 border border-[#90CAF9] shadow-sm flex flex-col gap-4 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#90CAF9]/40">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#2196F3]" />
                <h3 className="text-sm font-bold text-[#0D47A1] uppercase tracking-wider">
                  Section 8 JSON Lines Log Viewer
                </h3>
              </div>

              {/* Log File Selector */}
              <div className="flex items-center gap-2">
                <div className="w-56">
                  <CustomSelect
                    value={selectedFile}
                    onChange={(val) => setSelectedFile(val)}
                    size="sm"
                    options={
                      logFiles.length > 0
                        ? logFiles.map((f) => ({
                            value: f.name,
                            label: f.name,
                            badge: `${(f.sizeBytes / 1024).toFixed(1)} KB`,
                          }))
                        : [{ value: 'render.log', label: 'render.log' }]
                    }
                  />
                </div>

                <button
                  onClick={fetchLogEntries}
                  title="Refresh logs"
                  className="p-2 rounded-xl bg-[#E3F2FD]/50 hover:bg-[#E3F2FD] text-[#0D47A1] border border-[#90CAF9] transition-all"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isLogsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Filter strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1 bg-[#E3F2FD]/50 p-1 rounded-xl border border-[#90CAF9]">
                {['all', 'info', 'warn', 'error'].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setLogLevel(lvl)}
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                      logLevel === lvl
                        ? 'bg-[#2196F3] text-white shadow-sm'
                        : 'text-slate-600 hover:text-[#0D47A1]'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3 h-3 text-[#2196F3] absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Filter events/messages..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="bg-[#E3F2FD]/40 border border-[#90CAF9] rounded-xl pl-7 pr-2.5 py-1 text-[11px] text-[#0D47A1] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2196F3] w-48"
                />
              </div>
            </div>

            {/* Log Stream Terminal Window */}
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 font-mono text-[11px] h-[480px] overflow-y-auto divide-y divide-slate-800/60 shadow-inner">
              {logEntries.map((l, i) => (
                <div key={i} className="py-1.5 flex items-start gap-2 hover:bg-slate-800/40 transition-colors">
                  <span className="text-slate-400 shrink-0 text-[10px]">
                    {l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : ''}
                  </span>
                  <span
                    className={`uppercase text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      l.level === 'error'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : l.level === 'warn'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    }`}
                  >
                    {l.level}
                  </span>
                  <span className="text-sky-400 shrink-0 font-semibold">
                    [{l.service || 'api'}:{l.channel || 'render'}]
                  </span>
                  {l.event && (
                    <span className="text-amber-300 font-semibold shrink-0">
                      {l.event}:
                    </span>
                  )}
                  <span className="text-slate-200 break-all">{l.message}</span>
                </div>
              ))}

              {logEntries.length === 0 && !isLogsLoading && (
                <div className="py-24 text-center text-slate-500 italic">
                  No log entries found matching criteria in {selectedFile}.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
