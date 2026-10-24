'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Send,
  Calendar,
  Clock,
  Sparkles,
  Plus,
  Trash2,
  ExternalLink,
  Eye,
  ThumbsUp,
  MessageSquare,
  Share2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Hash,
  Shuffle,
  Video,
  Layers,
  Check,
  X,
  TrendingUp,
  BarChart3,
  Flame,
  FileText,
  Copy,
  Zap,
  ChevronDown,
  UserPlus,
  Key,
  Globe,
  Lock,
  Users,
  Settings as SettingsIcon,
  Sunrise,
  Sun,
  Moon,
  Compass,
  AtSign,
  Terminal,
  Play,
  Cpu,
} from 'lucide-react';
import { NoticeModal } from './ui/NoticeModal';

export type ThreadsSubTab = 'composer' | 'posts' | 'analytics' | 'mcp';

interface ThreadsPublisherViewProps {
  initialSubTab?: ThreadsSubTab;
}

export interface ThreadsAccountItem {
  _id: string;
  userId: string;
  username: string;
  displayName: string;
  profilePictureUrl?: string;
  biography?: string;
  followerCount?: number;
  accessToken?: string;
  isActive: boolean;
  isSimulated: boolean;
  createdAt?: string;
}

interface PostDraftItem {
  text: string;
  mediaUrl?: string;
  mediaType?: 'IMAGE' | 'VIDEO';
  isSpoilerMedia?: boolean;
  topic?: string;
  videoTitle?: string;
}

interface ThreadsPostRecord {
  _id: string;
  accountId: string;
  username: string;
  posts: Array<{
    text: string;
    mediaUrl?: string;
    mediaType?: 'IMAGE' | 'VIDEO';
    topic?: string;
  }>;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  scheduleAt?: string;
  publishedAt?: string;
  threadsPermalink?: string;
  error?: string;
  autoRepost?: {
    enabled: boolean;
    delaysHours: number[];
  };
  followUp?: {
    enabled: boolean;
    text: string;
    status: string;
  };
  analytics?: {
    views: number;
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
    engagementRate: number;
  };
  createdAt: string;
}

interface VideoOption {
  id: string;
  title: string;
  name: string;
  duration: number;
  driveLink?: string;
  localPath?: string;
}

export function ThreadsPublisherView({ initialSubTab = 'composer' }: ThreadsPublisherViewProps) {
  const [subTab, setSubTab] = useState<ThreadsSubTab>(initialSubTab);

  // Sync subTab if prop changes
  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  // MCP Test Console State
  const [mcpConsoleLoading, setMcpConsoleLoading] = useState<boolean>(false);
  const [mcpConsoleOutput, setMcpConsoleOutput] = useState<string | null>(null);
  const [mcpConsoleStatus, setMcpConsoleStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [mcpCopiedUrl, setMcpCopiedUrl] = useState<boolean>(false);
  const [mcpCopiedConfig, setMcpCopiedConfig] = useState<boolean>(false);
  const [mcpCopiedStdio, setMcpCopiedStdio] = useState<boolean>(false);
  const [mcpPingMs, setMcpPingMs] = useState<number | null>(null);

  const handleTestMcp = async (method: string, params: Record<string, any> = {}) => {
    setMcpConsoleLoading(true);
    setMcpConsoleStatus('idle');
    const start = performance.now();
    try {
      let body: any;
      if (method === 'initialize') {
        body = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } };
      } else if (method === 'tools/list') {
        body = { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} };
      } else {
        body = { jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: method, arguments: params } };
      }

      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const end = performance.now();
      setMcpPingMs(Math.round(end - start));
      const data = await res.json();
      setMcpConsoleOutput(JSON.stringify(data, null, 2));
      setMcpConsoleStatus(res.ok && !data.error ? 'success' : 'error');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMcpConsoleOutput(JSON.stringify({ error: msg }, null, 2));
      setMcpConsoleStatus('error');
    } finally {
      setMcpConsoleLoading(false);
    }
  };

  // Accounts state
  const [accounts, setAccounts] = useState<ThreadsAccountItem[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState<boolean>(false);
  const [isManageAccountsModalOpen, setIsManageAccountsModalOpen] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'oauth' | 'token' | 'manage'>('oauth');
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const pendingSelectUsername = useRef<string | null>(null);

  // Manual token & custom account input state
  const [tokenInput, setTokenInput] = useState<string>('');
  const [customUsername, setCustomUsername] = useState<string>('');
  const [customDisplayName, setCustomDisplayName] = useState<string>('');
  const [customBio, setCustomBio] = useState<string>('');
  const [isConnectingAccount, setIsConnectingAccount] = useState<boolean>(false);
  const [actionLoadingAccountId, setActionLoadingAccountId] = useState<string | null>(null);

  // Meta OAuth Configuration state
  const [oauthStatus, setOauthStatus] = useState<{
    configured: boolean;
    authUrl: string | null;
    appId?: string;
    redirectUri?: string;
    message?: string;
  }>({
    configured: false,
    authUrl: null,
  });
  const [oauthAppIdInput, setOauthAppIdInput] = useState<string>('');
  const [oauthAppSecretInput, setOauthAppSecretInput] = useState<string>('');
  const [oauthRedirectUriInput, setOauthRedirectUriInput] = useState<string>('http://localhost:3000/auth/threads/callback');
  const [isSavingOAuthConfig, setIsSavingOAuthConfig] = useState<boolean>(false);
  const [showOAuthCredentialsForm, setShowOAuthCredentialsForm] = useState<boolean>(false);
  const [copiedOAuthUrl, setCopiedOAuthUrl] = useState<boolean>(false);

  // Active account computation (null if no accounts connected)
  const selectedAccount =
    accounts.find((a) => a._id === selectedAccountId || a.userId === selectedAccountId) ||
    accounts[0] ||
    null;

  // Modal notice state
  const [notice, setNotice] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
  }>({
    isOpen: false,
    message: '',
  });

  // --- COMPOSER STATE ---
  const [threadPosts, setThreadPosts] = useState<PostDraftItem[]>([
    {
      text: '',
      topic: 'Cinema',
      mediaType: 'VIDEO',
    },
  ]);
  const [publishMode, setPublishMode] = useState<'schedule' | 'now' | 'draft'>('schedule');
  const [scheduleDate, setScheduleDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + (d.getHours() >= 23 ? 1 : 0));
    return d.toISOString().split('T')[0];
  });
  const [scheduleTime, setScheduleTime] = useState<string>('21:00');
  const [randomizeMinutes, setRandomizeMinutes] = useState<boolean>(true);
  const [autoRepostEnabled, setAutoRepostEnabled] = useState<boolean>(false);
  const [autoFollowUpEnabled, setAutoFollowUpEnabled] = useState<boolean>(true);
  const [followUpText, setFollowUpText] = useState<string>(
    "I've spent 1000s of hours finding movies that most people never discover. I'm building a curated Movie Vault filled with hidden gems, mind-bending thrillers, unforgettable endings, and underrated masterpieces. Comment #VAULT if you want early access when it launches."
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Video Picker Modal state
  const [isVideoPickerOpen, setIsVideoPickerOpen] = useState<boolean>(false);
  const [targetPostIndexForVideo, setTargetPostIndexForVideo] = useState<number>(0);
  const [availableVideos, setAvailableVideos] = useState<VideoOption[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState<boolean>(false);

  // --- POSTS QUEUE STATE ---
  const [postsList, setPostsList] = useState<ThreadsPostRecord[]>([]);
  const [postsCounts, setPostsCounts] = useState({ all: 0, scheduled: 0, published: 0, draft: 0, failed: 0 });
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'published' | 'draft' | 'failed'>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingPosts, setIsLoadingPosts] = useState<boolean>(false);

  // Reschedule Modal
  const [rescheduleModal, setRescheduleModal] = useState<{
    isOpen: boolean;
    postId?: string;
    currentDate?: string;
    currentTime?: string;
  }>({ isOpen: false });

  // --- ANALYTICS STATE ---
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsAccountFilter, setAnalyticsAccountFilter] = useState<string>('all');
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState<boolean>(false);

  // Close account dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
        setIsAccountDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Fetch Accounts
  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/threads/accounts');
      const data = await res.json();
      if (data.success && data.accounts) {
        setAccounts(data.accounts);
        if (pendingSelectUsername.current) {
          const match = data.accounts.find(
            (a: ThreadsAccountItem) =>
              a.username.toLowerCase() === pendingSelectUsername.current?.toLowerCase()
          );
          if (match) {
            setSelectedAccountId(match._id || match.userId);
            pendingSelectUsername.current = null;
          }
        } else if (!selectedAccountId && data.accounts.length > 0) {
          setSelectedAccountId(data.accounts[0]._id || data.accounts[0].userId);
        }
      }
    } catch {
      // Ignore
    }
  }, [selectedAccountId]);

  // 2. Fetch OAuth status
  const fetchOAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/threads/auth');
      const data = await res.json();
      if (data.success) {
        setOauthStatus({
          configured: data.configured,
          authUrl: data.authUrl,
          appId: data.appId,
          redirectUri: data.redirectUri,
          message: data.message,
        });
        if (data.appId) setOauthAppIdInput(data.appId);
        if (data.redirectUri) setOauthRedirectUriInput(data.redirectUri);
      }
    } catch {
      // Ignore
    }
  }, []);

  // 3. Fetch Posts Queue
  const fetchPosts = useCallback(async () => {
    setIsLoadingPosts(true);
    try {
      const queryParts: string[] = [];
      if (statusFilter !== 'all') queryParts.push(`status=${statusFilter}`);
      if (accountFilter !== 'all') queryParts.push(`search=${encodeURIComponent(accountFilter)}`);
      else if (searchQuery) queryParts.push(`search=${encodeURIComponent(searchQuery)}`);

      const url = `/api/threads/posts${queryParts.length > 0 ? `?${queryParts.join('&')}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setPostsList(data.posts || []);
        if (data.counts) setPostsCounts(data.counts);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingPosts(false);
    }
  }, [statusFilter, accountFilter, searchQuery]);

  // 4. Fetch Analytics
  const fetchAnalytics = useCallback(async () => {
    setIsLoadingAnalytics(true);
    try {
      const url = `/api/threads/analytics${analyticsAccountFilter !== 'all' ? `?account=${encodeURIComponent(analyticsAccountFilter)}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setAnalyticsData(data);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [analyticsAccountFilter]);

  // 5. Fetch Available Videos from Split Jobs
  const fetchAvailableVideos = async () => {
    setIsLoadingVideos(true);
    try {
      const res = await fetch('/api/youtube/videos?folder=all');
      const data = await res.json();
      if (data.videos) {
        setAvailableVideos(data.videos);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingVideos(false);
    }
  };

  // Initial load & OAuth callback parameter detection
  useEffect(() => {
    fetchAccounts();
    fetchOAuthStatus();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('threadsConnected') === 'true') {
        const u = params.get('username') || 'Account';
        pendingSelectUsername.current = u;
        setNotice({
          isOpen: true,
          title: 'Threads Account Connected!',
          message: `Successfully connected @${u} via Meta Threads OAuth. You can now compose, schedule, and manage threads for this account!`,
          type: 'success',
        });
        window.history.replaceState({}, '', '/?tab=threads-composer');
      } else if (params.get('threadsError')) {
        setNotice({
          isOpen: true,
          title: 'Threads OAuth Error',
          message: params.get('threadsError') || 'Failed to authenticate with Threads.',
          type: 'error',
        });
        window.history.replaceState({}, '', '/?tab=threads-composer');
      }
    }
  }, [fetchAccounts, fetchOAuthStatus]);

  useEffect(() => {
    if (subTab === 'posts') {
      fetchPosts();
    } else if (subTab === 'analytics') {
      fetchAnalytics();
    }
  }, [subTab, fetchPosts, fetchAnalytics]);

  // Handle Thread Post Items
  const handlePostTextChange = (index: number, text: string) => {
    setThreadPosts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], text };
      return copy;
    });
  };

  const handlePostTopicChange = (index: number, topic: string) => {
    setThreadPosts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], topic };
      return copy;
    });
  };

  const handleAddThreadPost = () => {
    if (threadPosts.length >= 10) return;
    setThreadPosts((prev) => [
      ...prev,
      {
        text: '',
        topic: prev[0]?.topic || 'Cinema',
        mediaType: 'VIDEO',
      },
    ]);
  };

  const handleRemoveThreadPost = (index: number) => {
    if (threadPosts.length <= 1) return;
    setThreadPosts((prev) => prev.filter((_, i) => i !== index));
  };

  // Open Video Picker
  const openVideoPicker = (postIndex: number) => {
    setTargetPostIndexForVideo(postIndex);
    setIsVideoPickerOpen(true);
    fetchAvailableVideos();
  };

  // Select Video
  const handleSelectVideo = (vid: VideoOption) => {
    const videoUrl = vid.driveLink || vid.localPath || '';
    setThreadPosts((prev) => {
      const copy = [...prev];
      copy[targetPostIndexForVideo] = {
        ...copy[targetPostIndexForVideo],
        mediaUrl: videoUrl,
        mediaType: 'VIDEO',
        videoTitle: vid.title || vid.name,
      };
      return copy;
    });
    setIsVideoPickerOpen(false);
  };

  // Remove Video from Post
  const handleRemoveVideo = (index: number) => {
    setThreadPosts((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        mediaUrl: '',
        videoTitle: '',
      };
      return copy;
    });
  };

  // Insert Templates / CTAs
  const handleInsertVaultCTA = (index: number) => {
    const cta = "\n\nI'm building a curated Movie Vault filled with hidden gems, mind-bending thrillers, and underrated masterpieces. Comment #VAULT if you want early access.";
    setThreadPosts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], text: copy[index].text + cta };
      return copy;
    });
  };

  const handleInsertHook = (index: number, hookText: string) => {
    setThreadPosts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], text: hookText + (copy[index].text ? `\n\n${copy[index].text}` : '') };
      return copy;
    });
  };

  // Preset Slots Handler
  const applyPresetSlot = (timeStr: string) => {
    let finalTime = timeStr;
    if (randomizeMinutes) {
      const [h, m] = timeStr.split(':').map(Number);
      const delta = Math.floor(Math.random() * 21) - 10;
      let newM = m + delta;
      let newH = h;
      if (newM < 0) {
        newM += 60;
        newH = (newH - 1 + 24) % 24;
      } else if (newM >= 60) {
        newM -= 60;
        newH = (newH + 1) % 24;
      }
      finalTime = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    }
    setScheduleTime(finalTime);
  };

  // Submit / Publish / Schedule Thread
  const handleSubmitThread = async () => {
    if (!threadPosts[0]?.text.trim()) {
      setNotice({
        isOpen: true,
        title: 'Content Required',
        message: 'The main post text cannot be empty.',
        type: 'warning',
      });
      return;
    }

    for (let i = 0; i < threadPosts.length; i++) {
      if (threadPosts[i].text.length > 500) {
        setNotice({
          isOpen: true,
          title: 'Character Limit Exceeded',
          message: `Post #${i + 1} exceeds the 500-character limit (${threadPosts[i].text.length}/500). Please trim it down.`,
          type: 'error',
        });
        return;
      }
    }

    if (!selectedAccount) {
      setNotice({
        isOpen: true,
        title: 'Account Required',
        message: 'Please connect a Threads account before scheduling or publishing.',
        type: 'warning',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let finalScheduleAt: string | undefined = undefined;
      if (publishMode === 'schedule') {
        finalScheduleAt = `${scheduleDate}T${scheduleTime}:00`;
      }

      const payload = {
        accountId: selectedAccount._id || selectedAccount.userId,
        username: selectedAccount.username,
        posts: threadPosts.map((p) => ({
          text: p.text,
          mediaUrl: p.mediaUrl || '',
          mediaType: p.mediaType || 'VIDEO',
          isSpoilerMedia: !!p.isSpoilerMedia,
          topic: p.topic || '',
        })),
        scheduleAt: finalScheduleAt,
        publishNow: publishMode === 'now',
        autoRepost: {
          enabled: autoRepostEnabled,
          delaysHours: [168, 336],
        },
        followUp: {
          enabled: autoFollowUpEnabled,
          text: followUpText,
          delayMinutes: 0,
        },
      };

      const res = await fetch('/api/threads/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit thread');
      }

      if (publishMode === 'now') {
        setNotice({
          isOpen: true,
          title: 'Thread Published!',
          message: `Successfully published to Threads for @${selectedAccount.username}!`,
          type: 'success',
        });
      } else if (publishMode === 'schedule') {
        setNotice({
          isOpen: true,
          title: 'Thread Scheduled!',
          message: `Scheduled to publish on ${scheduleDate} at ${scheduleTime} for @${selectedAccount.username}.`,
          type: 'success',
        });
      } else {
        setNotice({
          isOpen: true,
          title: 'Draft Saved',
          message: 'Your thread has been saved to drafts.',
          type: 'info',
        });
      }

      setThreadPosts([{ text: '', topic: 'Cinema', mediaType: 'VIDEO' }]);
      fetchPosts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({
        isOpen: true,
        title: 'Submission Error',
        message: msg,
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Instant Manual Dispatch of a scheduled/draft post
  const handlePublishNow = async (id: string) => {
    try {
      const res = await fetch(`/api/threads/posts/${id}/publish`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setNotice({
          isOpen: true,
          title: 'Published!',
          message: 'Thread successfully dispatched to Threads.',
          type: 'success',
        });
        fetchPosts();
      } else {
        throw new Error(data.error || 'Failed to publish');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ isOpen: true, title: 'Error', message: msg, type: 'error' });
    }
  };

  // Delete Post
  const handleDeletePost = async (id: string) => {
    if (!confirm('Are you sure you want to delete this thread?')) return;
    try {
      const res = await fetch(`/api/threads/posts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchPosts();
      }
    } catch {
      // Ignore
    }
  };

  // Apply Reschedule
  const handleApplyReschedule = async () => {
    if (!rescheduleModal.postId || !rescheduleModal.currentDate || !rescheduleModal.currentTime) return;
    try {
      const newScheduleAt = `${rescheduleModal.currentDate}T${rescheduleModal.currentTime}:00`;
      const res = await fetch(`/api/threads/posts/${rescheduleModal.postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleAt: newScheduleAt, status: 'scheduled' }),
      });
      const data = await res.json();
      if (data.success) {
        setRescheduleModal({ isOpen: false });
        fetchPosts();
      }
    } catch {
      // Ignore
    }
  };

  // Trigger Cron Cycle
  const handleTriggerCycle = async () => {
    try {
      const res = await fetch('/api/threads/cron', { method: 'POST' });
      const data = await res.json();
      setNotice({
        isOpen: true,
        title: 'Scheduler Run Completed',
        message: `Published: ${data.published}, Metrics synced: ${data.metricsSynced}`,
        type: 'info',
      });
      fetchPosts();
      fetchAnalytics();
    } catch {
      // Ignore
    }
  };

  // Start Meta OAuth Flow
  const handleStartOAuth = async () => {
    if (oauthStatus.configured && oauthStatus.authUrl) {
      window.location.href = oauthStatus.authUrl;
    } else {
      setNotice({
        isOpen: true,
        title: 'Meta OAuth Setup Required',
        message:
          oauthStatus.message ||
          'To connect directly via Meta OAuth, add THREADS_APP_ID and THREADS_APP_SECRET in your environment or Settings.',
        type: 'warning',
      });
    }
  };

  // Connect via Direct Meta Token
  const handleConnectToken = async () => {
    if (!tokenInput.trim()) {
      setNotice({ isOpen: true, title: 'Token Required', message: 'Please enter your Meta Threads Access Token.', type: 'warning' });
      return;
    }
    setIsConnectingAccount(true);
    try {
      const res = await fetch('/api/threads/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'token', accessToken: tokenInput.trim() }),
      });
      const data = await res.json();
      if (data.success && data.account) {
        setNotice({
          isOpen: true,
          title: 'Account Connected!',
          message: `Successfully connected @${data.account.username}!`,
          type: 'success',
        });
        setTokenInput('');
        fetchAccounts();
        setSelectedAccountId(data.account._id || data.account.userId);
        setIsManageAccountsModalOpen(false);
      } else {
        throw new Error(data.error || 'Failed to verify token');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ isOpen: true, title: 'Connection Failed', message: msg, type: 'error' });
    } finally {
      setIsConnectingAccount(false);
    }
  };

  // Add Custom / Sandbox Account
  const handleAddCustomAccount = async () => {
    if (!customUsername.trim()) {
      setNotice({ isOpen: true, title: 'Username Required', message: 'Please enter a username handle.', type: 'warning' });
      return;
    }
    setIsConnectingAccount(true);
    try {
      const res = await fetch('/api/threads/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'custom',
          username: customUsername.trim(),
          displayName: customDisplayName.trim() || customUsername.trim(),
          biography: customBio.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && data.account) {
        setNotice({
          isOpen: true,
          title: 'Account Added!',
          message: `Added @${data.account.username} to your Threads accounts.`,
          type: 'success',
        });
        setCustomUsername('');
        setCustomDisplayName('');
        setCustomBio('');
        fetchAccounts();
        setSelectedAccountId(data.account._id || data.account.userId);
        setIsManageAccountsModalOpen(false);
      } else {
        throw new Error(data.error || 'Failed to add account');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ isOpen: true, title: 'Failed to Add', message: msg, type: 'error' });
    } finally {
      setIsConnectingAccount(false);
    }
  };

  // Disconnect Account
  const handleDisconnectAccount = async (id: string, username: string) => {
    if (!confirm(`Are you sure you want to disconnect @${username}?`)) return;
    try {
      const res = await fetch(`/api/threads/accounts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setNotice({ isOpen: true, title: 'Disconnected', message: `@${username} was removed.`, type: 'info' });
        fetchAccounts();
      }
    } catch {
      // Ignore
    }
  };

  // Save Meta Threads OAuth App Credentials
  const handleSaveOAuthConfig = async () => {
    if (!oauthAppIdInput.trim()) {
      setNotice({ isOpen: true, title: 'App ID Required', message: 'Please enter your Meta Threads App ID.', type: 'warning' });
      return;
    }
    setIsSavingOAuthConfig(true);
    try {
      const res = await fetch('/api/threads/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: oauthAppIdInput.trim(),
          appSecret: oauthAppSecretInput.trim(),
          redirectUri: oauthRedirectUriInput.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotice({
          isOpen: true,
          title: 'OAuth Config Saved',
          message: 'Meta Threads App credentials successfully saved! You can now authorize accounts.',
          type: 'success',
        });
        await fetchOAuthStatus();
        setShowOAuthCredentialsForm(false);
      } else {
        throw new Error(data.error || 'Failed to save OAuth credentials');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ isOpen: true, title: 'Failed to Save', message: msg, type: 'error' });
    } finally {
      setIsSavingOAuthConfig(false);
    }
  };

  // Copy OAuth URL for Incognito / Multi-account
  const handleCopyOAuthUrl = async () => {
    if (!oauthStatus.authUrl) return;
    try {
      await navigator.clipboard.writeText(oauthStatus.authUrl);
      setCopiedOAuthUrl(true);
      setTimeout(() => setCopiedOAuthUrl(false), 3000);
      setNotice({
        isOpen: true,
        title: 'OAuth URL Copied!',
        message: 'Open this link in an Incognito / Private window or another browser where your second Threads account is logged in. Once approved, it will automatically connect both accounts!',
        type: 'info',
      });
    } catch {
      // Fallback
    }
  };

  // Refresh Account Token (+60 days)
  const handleRefreshToken = async (accountId: string, username: string) => {
    setActionLoadingAccountId(accountId);
    try {
      const res = await fetch(`/api/threads/accounts/${accountId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh' }),
      });
      const data = await res.json();
      if (data.success) {
        setNotice({
          isOpen: true,
          title: 'Token Refreshed',
          message: data.message || `Meta token for @${username} was extended for 60 days.`,
          type: 'success',
        });
        fetchAccounts();
      } else {
        throw new Error(data.message || data.error || 'Failed to refresh token');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ isOpen: true, title: 'Refresh Failed', message: msg, type: 'error' });
    } finally {
      setActionLoadingAccountId(null);
    }
  };

  // Sync / Verify Account Profile
  const handleSyncAccount = async (accountId: string, username: string) => {
    setActionLoadingAccountId(accountId);
    try {
      const res = await fetch(`/api/threads/accounts/${accountId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      const data = await res.json();
      if (data.success) {
        setNotice({
          isOpen: true,
          title: 'Account Synced',
          message: `Verified and refreshed profile for @${username}.`,
          type: 'success',
        });
        fetchAccounts();
      } else {
        throw new Error(data.error || 'Failed to sync account');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ isOpen: true, title: 'Sync Failed', message: msg, type: 'error' });
    } finally {
      setActionLoadingAccountId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-fuchsia-500 flex items-center justify-center font-bold text-xl text-white shadow-md shadow-purple-500/20">
              @
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  Threads Studio & Multi-Account
                </h1>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  Native OAuth Hub
                </span>
              </div>

              {/* Multi-Account Selector Pill */}
              <div className="relative mt-1" ref={accountDropdownRef}>
                {selectedAccount ? (
                  <button
                    type="button"
                    onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                    className="flex items-center gap-2 bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 px-2.5 py-1 rounded-xl text-xs transition-all shadow-sm group"
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-slate-200 group-hover:text-white">
                      @{selectedAccount.username}
                    </span>
                    <span className="text-slate-400 text-[11px] truncate max-w-[120px]">
                      ({selectedAccount.displayName})
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                        selectedAccount.isSimulated
                          ? 'bg-purple-900/60 text-purple-300 border border-purple-700/50'
                          : 'bg-emerald-950/70 text-emerald-400 border border-emerald-600/40'
                      }`}
                    >
                      {selectedAccount.isSimulated ? 'Sandbox' : 'Meta OAuth'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white ml-0.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsManageAccountsModalOpen(true);
                      setModalTab('oauth');
                    }}
                    className="flex items-center gap-1.5 bg-purple-900/40 hover:bg-purple-900/60 border border-purple-600/50 px-2.5 py-1 rounded-xl text-xs transition-all shadow-sm text-purple-300 font-medium"
                  >
                    <AtSign className="w-3.5 h-3.5 text-purple-400" />
                    <span>No Account Connected</span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded font-bold uppercase ml-1">
                      Connect
                    </span>
                  </button>
                )}

                {/* Account Switcher Dropdown */}
                {isAccountDropdownOpen && selectedAccount && (
                  <div className="absolute left-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 text-slate-200 animate-in fade-in slide-in-from-top-1">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Switch Account ({accounts.length})</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAccountDropdownOpen(false);
                          setIsManageAccountsModalOpen(true);
                        }}
                        className="text-purple-400 hover:text-purple-300 font-semibold text-[10px]"
                      >
                        Manage All
                      </button>
                    </div>

                    <div className="space-y-1 max-h-56 overflow-y-auto">
                      {accounts.map((acc) => {
                        const isCurrent = acc._id === selectedAccount._id || acc.userId === selectedAccount.userId;
                        return (
                          <button
                            key={acc._id || acc.userId}
                            type="button"
                            onClick={() => {
                              setSelectedAccountId(acc._id || acc.userId);
                              setIsAccountDropdownOpen(false);
                            }}
                            className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-colors ${
                              isCurrent ? 'bg-purple-600 text-white font-semibold' : 'hover:bg-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                                @
                              </div>
                              <div className="truncate">
                                <div className="text-xs truncate">@{acc.username}</div>
                                <div className={`text-[10px] truncate ${isCurrent ? 'text-purple-100' : 'text-slate-400'}`}>
                                  {acc.displayName || 'Threads Creator'}
                                </div>
                              </div>
                            </div>
                            {isCurrent && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1.5" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2 mt-2 border-t border-slate-800 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAccountDropdownOpen(false);
                          setIsManageAccountsModalOpen(true);
                          setModalTab('oauth');
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-800 text-purple-400 hover:text-purple-300 text-xs font-semibold flex items-center gap-2"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ Connect Another Account</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 shadow-inner">
            <button
              onClick={() => setSubTab('composer')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                subTab === 'composer'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Composer & Scheduler
            </button>
            <button
              onClick={() => setSubTab('posts')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                subTab === 'posts'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Scheduled & Queue
              {postsCounts.scheduled > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-bold ml-1">
                  {postsCounts.scheduled}
                </span>
              )}
            </button>
            <button
              onClick={() => setSubTab('analytics')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                subTab === 'analytics'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Analytics & Insights
            </button>
            <button
              onClick={() => {
                setSubTab('mcp');
                if (!mcpConsoleOutput) {
                  handleTestMcp('initialize');
                }
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                subTab === 'mcp'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              MCP Server & API
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold ml-1 border border-emerald-500/30">
                Ready
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* VIEW 1: COMPOSER & SCHEDULER                                   */}
      {/* ============================================================== */}
      {subTab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Thread Builder (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Active Account Identity Strip & Quick Switcher */}
            {!selectedAccount ? (
              <div className="p-4 bg-purple-50/80 border border-purple-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                    <AtSign className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">No Threads Account Connected</div>
                    <div className="text-[11px] text-slate-500">
                      Connect your Threads account via Meta OAuth or access token to publish and schedule threads.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsManageAccountsModalOpen(true);
                    setModalTab('oauth');
                  }}
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shrink-0 transition-all shadow-sm flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Connect Account</span>
                </button>
              </div>
            ) : (
              <div className="p-3 bg-gradient-to-r from-purple-50 via-indigo-50/50 to-white border border-purple-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-purple-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                    @
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        Publishing as <strong className="text-purple-700 font-extrabold">@{selectedAccount.username}</strong>
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                          selectedAccount.isSimulated
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {selectedAccount.isSimulated ? 'Sandbox' : 'Meta OAuth'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {selectedAccount.displayName} • {selectedAccount.followerCount?.toLocaleString() || 0} followers
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {accounts.length > 1 && (
                    <select
                      value={selectedAccount._id || selectedAccount.userId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="text-xs font-bold bg-white border border-purple-200 text-purple-900 rounded-xl px-2.5 py-1.5 shadow-xs outline-none focus:ring-2 focus:ring-purple-400"
                      title="Switch publishing account"
                    >
                      {accounts.map((acc) => (
                        <option key={acc._id || acc.userId} value={acc._id || acc.userId}>
                          @{acc.username} ({acc.isSimulated ? 'Sandbox' : 'OAuth'})
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsManageAccountsModalOpen(true);
                      setModalTab('oauth');
                    }}
                    className="text-xs font-bold text-purple-700 hover:text-purple-800 bg-white hover:bg-purple-50 border border-purple-200 px-2.5 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
                    title="Connect multiple Threads accounts via OAuth"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Add Account</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                Thread Composer ({threadPosts.length} {threadPosts.length === 1 ? 'post' : 'posts'})
              </h2>
              <button
                type="button"
                onClick={handleAddThreadPost}
                className="text-xs font-semibold text-purple-600 hover:text-purple-700 hover:bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add to Thread
              </button>
            </div>

            {/* Thread Posts List */}
            <div className="space-y-4">
              {threadPosts.map((post, idx) => {
                const charCount = post.text.length;
                const charLimit = 500;
                const isOverLimit = charCount > charLimit;
                const isNearLimit = charCount >= 450 && !isOverLimit;

                return (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 relative transition-all focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/10"
                  >
                    {/* Header info */}
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-700">
                          {idx === 0 ? 'Main Post' : `Reply #${idx}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Topic Tag Chip */}
                        <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] text-slate-600">
                          <Hash className="w-3 h-3 text-slate-400" />
                          <input
                            type="text"
                            value={post.topic || ''}
                            onChange={(e) => handlePostTopicChange(idx, e.target.value)}
                            placeholder="topic tag..."
                            className="bg-transparent border-none outline-none text-[11px] w-20 text-slate-700 placeholder:text-slate-400"
                          />
                        </div>
                        {threadPosts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveThreadPost(idx)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded-md"
                            title="Remove this post"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Textarea */}
                    <textarea
                      rows={idx === 0 ? 4 : 3}
                      value={post.text}
                      onChange={(e) => handlePostTextChange(idx, e.target.value)}
                      placeholder={
                        idx === 0
                          ? "What's the movie about? Write an addictive hook, mind-bending fact or question..."
                          : 'Continue the thread with part 2, ending breakdown, or trivia...'
                      }
                      className="w-full resize-none text-sm text-slate-800 placeholder:text-slate-400 outline-none border-none p-1 leading-relaxed"
                    />

                    {/* Media Attachment Preview if attached */}
                    {post.mediaUrl && (
                      <div className="mt-2 p-2.5 rounded-xl bg-purple-50/70 border border-purple-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="p-1.5 bg-purple-600 text-white rounded-lg shrink-0">
                            <Video className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-semibold text-purple-950 truncate">
                              {post.videoTitle || 'Attached Video Media'}
                            </div>
                            <div className="text-[10px] text-purple-600 truncate">{post.mediaUrl}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveVideo(idx)}
                          className="text-purple-400 hover:text-red-500 p-1 shrink-0"
                          title="Remove attached video"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Post Footer Toolbar */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Attach Video Button */}
                        <button
                          type="button"
                          onClick={() => openVideoPicker(idx)}
                          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-purple-600 hover:bg-slate-100 px-2 py-1 rounded-lg transition-colors"
                        >
                          <Video className="w-3.5 h-3.5 text-purple-500" />
                          <span>{post.mediaUrl ? 'Change Video' : 'Attach Video Part'}</span>
                        </button>

                        {/* Spoiler toggle */}
                        <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer select-none ml-2">
                          <input
                            type="checkbox"
                            checked={!!post.isSpoilerMedia}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setThreadPosts((prev) => {
                                const copy = [...prev];
                                copy[idx] = { ...copy[idx], isSpoilerMedia: checked };
                                return copy;
                              });
                            }}
                            className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-3.5 w-3.5"
                          />
                          <span>Spoiler blur</span>
                        </label>
                      </div>

                      {/* Character Count & Indicator */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs font-mono font-semibold ${
                            isOverLimit
                              ? 'text-red-600'
                              : isNearLimit
                              ? 'text-amber-600'
                              : 'text-slate-400'
                          }`}
                        >
                          {charCount}/{charLimit}
                        </span>
                        <div className="w-4 h-4 relative flex items-center justify-center">
                          <svg className="w-4 h-4 transform -rotate-90">
                            <circle
                              cx="8"
                              cy="8"
                              r="6"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="text-slate-100"
                              fill="transparent"
                            />
                            <circle
                              cx="8"
                              cy="8"
                              r="6"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeDasharray={37.7}
                              strokeDashoffset={Math.max(0, 37.7 - (charCount / charLimit) * 37.7)}
                              className={
                                isOverLimit
                                  ? 'text-red-500'
                                  : isNearLimit
                                  ? 'text-amber-500'
                                  : 'text-purple-500'
                              }
                              fill="transparent"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Fast Helpers: Movie Vault CTA & Viral Hooks */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-4 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  Fast Creator Shortcuts
                </span>
                <span className="text-[11px] text-purple-700 font-medium">1-Click Insert</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleInsertVaultCTA(0)}
                  className="bg-white text-purple-700 hover:bg-purple-600 hover:text-white border border-purple-200 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-all shadow-sm flex items-center gap-1"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  + Insert Movie Vault CTA (#VAULT)
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertHook(0, 'Almost nobody noticed this mind-bending detail in...')}
                  className="bg-white text-slate-700 hover:bg-purple-50 border border-slate-200 text-xs font-medium px-2.5 py-1.5 rounded-xl transition-all shadow-sm"
                >
                  Curiosity Gap Hook
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertHook(0, 'Tag someone who still hasn’t watched this underrated gem...')}
                  className="bg-white text-slate-700 hover:bg-purple-50 border border-slate-200 text-xs font-medium px-2.5 py-1.5 rounded-xl transition-all shadow-sm"
                >
                  Tag-Someone Hook
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertHook(0, 'Which one had the more shocking plot twist? A or B?')}
                  className="bg-white text-slate-700 hover:bg-purple-50 border border-slate-200 text-xs font-medium px-2.5 py-1.5 rounded-xl transition-all shadow-sm"
                >
                  Poll Hook
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Scheduling & Publishing Controls (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  Scheduling & Dispatch
                </h3>
                <span className="text-[11px] text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-md">
                  {selectedAccount ? `@${selectedAccount.username}` : 'No account'}
                </span>
              </div>

              {/* Mode Selection */}
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPublishMode('schedule')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    publishMode === 'schedule'
                      ? 'bg-white text-purple-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Schedule
                </button>
                <button
                  type="button"
                  onClick={() => setPublishMode('now')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    publishMode === 'now'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Post Now
                </button>
                <button
                  type="button"
                  onClick={() => setPublishMode('draft')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    publishMode === 'draft'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Draft
                </button>
              </div>

              {/* Schedule Date & Time Controls */}
              {publishMode === 'schedule' && (
                <div className="space-y-4 pt-1 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Publish Date
                      </label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Publish Time
                      </label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* 1-Click Fast Slots */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-slate-600">
                        1-Click Strategy Slots
                      </span>
                      <label className="flex items-center gap-1 text-[11px] text-purple-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={randomizeMinutes}
                          onChange={(e) => setRandomizeMinutes(e.target.checked)}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-3.5 w-3.5"
                        />
                        <span>±10m anti-detection</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyPresetSlot('09:00')}
                        className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50 text-xs font-medium text-slate-700 transition-all text-left"
                      >
                        <span className="flex items-center gap-2">
                          <Sunrise className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>9:00 AM — Indian / Bollywood</span>
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">Commute</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => applyPresetSlot('14:00')}
                        className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50 text-xs font-medium text-slate-700 transition-all text-left"
                      >
                        <span className="flex items-center gap-2">
                          <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>2:00 PM — Indian / Bollywood</span>
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">Lunch</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => applyPresetSlot('21:00')}
                        className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50 text-xs font-medium text-slate-700 transition-all text-left"
                      >
                        <span className="flex items-center gap-2">
                          <Moon className="w-4 h-4 text-purple-500 shrink-0" />
                          <span>9:00 PM — Hollywood / International</span>
                        </span>
                        <span className="font-mono text-[11px] text-purple-600 font-semibold">Prime</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => applyPresetSlot('23:00')}
                        className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50 text-xs font-medium text-slate-700 transition-all text-left"
                      >
                        <span className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span>11:00 PM — Hollywood / International</span>
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">Late Night</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => applyPresetSlot('01:00')}
                        className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50 text-xs font-medium text-slate-700 transition-all text-left"
                      >
                        <span className="flex items-center gap-2">
                          <Compass className="w-4 h-4 text-fuchsia-500 shrink-0" />
                          <span>1:00 AM — Movie Gems & Open Loop</span>
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">Deep Discussion</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced Controls: Auto-Repost & Follow-Up Reply */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                {/* Follow-up CTA auto-reply */}
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                      Auto Follow-up Reply (Vault CTA)
                    </span>
                    <input
                      type="checkbox"
                      checked={autoFollowUpEnabled}
                      onChange={(e) => setAutoFollowUpEnabled(e.target.checked)}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4"
                    />
                  </label>
                  {autoFollowUpEnabled && (
                    <textarea
                      rows={2}
                      value={followUpText}
                      onChange={(e) => setFollowUpText(e.target.value)}
                      className="w-full text-xs text-slate-700 border border-slate-200 rounded-xl p-2 bg-slate-50 outline-none focus:border-purple-500 resize-none font-sans"
                    />
                  )}
                </div>

                {/* Auto-Repost (Re-thread) */}
                <label className="flex items-center justify-between cursor-pointer pt-1">
                  <div>
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5 text-purple-600" />
                      Auto-Repost (Re-thread)
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Re-posts automatically after 7 & 14 days
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoRepostEnabled}
                    onChange={(e) => setAutoRepostEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4"
                  />
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmitThread}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : publishMode === 'now' ? (
                    <>
                      <Zap className="w-4 h-4" />
                      Publish Now{selectedAccount ? ` as @${selectedAccount.username}` : ''}
                    </>
                  ) : publishMode === 'schedule' ? (
                    <>
                      <Calendar className="w-4 h-4" />
                      Schedule Thread ({scheduleDate} @ {scheduleTime})
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Save Draft{selectedAccount ? ` (@${selectedAccount.username})` : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW 2: SCHEDULED & POSTS QUEUE                                */}
      {/* ============================================================== */}
      {subTab === 'posts' && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            {/* Status Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto w-full md:w-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                All ({postsCounts.all})
              </button>
              <button
                onClick={() => setStatusFilter('scheduled')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  statusFilter === 'scheduled' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500'
                }`}
              >
                <span>Scheduled</span>
                <span className="text-[10px] px-1 bg-white/20 rounded-full">{postsCounts.scheduled}</span>
              </button>
              <button
                onClick={() => setStatusFilter('published')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  statusFilter === 'published' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500'
                }`}
              >
                <span>Published</span>
                <span className="text-[10px] px-1 bg-white/20 rounded-full">{postsCounts.published}</span>
              </button>
              <button
                onClick={() => setStatusFilter('draft')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'draft' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500'
                }`}
              >
                Drafts ({postsCounts.draft})
              </button>
              <button
                onClick={() => setStatusFilter('failed')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'failed' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500'
                }`}
              >
                Failed ({postsCounts.failed})
              </button>
            </div>

            {/* Account filter and run actions */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
              {/* Filter by Account */}
              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none bg-white text-slate-700 font-medium"
              >
                <option value="all">All Accounts</option>
                {accounts.map((a) => (
                  <option key={a._id || a.userId} value={a.username}>
                    @{a.username}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleTriggerCycle}
                className="text-xs font-semibold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 border border-purple-200"
                title="Publish any scheduled posts due right now"
              >
                <Zap className="w-3.5 h-3.5 text-purple-600" />
                Run Scheduler
              </button>
              <button
                type="button"
                onClick={fetchPosts}
                disabled={isLoadingPosts}
                className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl"
                title="Refresh queue"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingPosts ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Posts List */}
          {postsList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
              <Clock className="w-10 h-10 mx-auto text-slate-300" />
              <div className="text-sm font-semibold text-slate-700">No threads found in this category</div>
              <p className="text-xs max-w-sm mx-auto">
                Ready to schedule your next video reel or thread? Switch to the Composer tab.
              </p>
              <button
                type="button"
                onClick={() => setSubTab('composer')}
                className="text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-xl shadow-md shadow-purple-500/20"
              >
                Compose Thread
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {postsList.map((post) => {
                const firstPost = post.posts[0];
                const totalParts = post.posts.length;

                return (
                  <div
                    key={post._id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:border-slate-300 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    {/* Left: Content snippet */}
                    <div className="space-y-1.5 max-w-xl min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                            post.status === 'scheduled'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : post.status === 'published'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : post.status === 'draft'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-red-100 text-red-800 border border-red-200'
                          }`}
                        >
                          {post.status}
                        </span>

                        <span className="text-xs font-semibold text-slate-700">
                          @{post.username}
                        </span>

                        {totalParts > 1 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                            {totalParts} posts in thread
                          </span>
                        )}

                        {firstPost?.mediaUrl && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 flex items-center gap-1">
                            <Video className="w-3 h-3" />
                            Video Attached
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-800 font-medium line-clamp-2 leading-relaxed">
                        {firstPost?.text}
                      </p>

                      {/* Timestamps & Metrics */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        {post.status === 'scheduled' && post.scheduleAt && (
                          <span className="text-amber-700 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-500" />
                            Scheduled for {new Date(post.scheduleAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        )}

                        {post.status === 'published' && post.publishedAt && (
                          <span className="text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Published {new Date(post.publishedAt).toLocaleDateString()}
                          </span>
                        )}

                        {post.analytics && post.status === 'published' && (
                          <div className="flex items-center gap-2.5 font-mono text-[11px] text-slate-600">
                            <span className="flex items-center gap-0.5" title="Views">
                              <Eye className="w-3 h-3 text-slate-400" />
                              {post.analytics.views}
                            </span>
                            <span className="flex items-center gap-0.5" title="Likes">
                              <ThumbsUp className="w-3 h-3 text-slate-400" />
                              {post.analytics.likes}
                            </span>
                            <span className="flex items-center gap-0.5" title="Replies">
                              <MessageSquare className="w-3 h-3 text-slate-400" />
                              {post.analytics.replies}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                      {post.status === 'scheduled' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const d = post.scheduleAt ? new Date(post.scheduleAt) : new Date();
                              setRescheduleModal({
                                isOpen: true,
                                postId: post._id,
                                currentDate: d.toISOString().split('T')[0],
                                currentTime: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
                              });
                            }}
                            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            Reschedule
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePublishNow(post._id)}
                            className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm flex items-center gap-1"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            Post Now
                          </button>
                        </>
                      )}

                      {post.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => handlePublishNow(post._id)}
                          className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm flex items-center gap-1"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Publish
                        </button>
                      )}

                      {post.status === 'published' && post.threadsPermalink && (
                        <a
                          href={post.threadsPermalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-purple-600 hover:bg-purple-50 flex items-center gap-1"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeletePost(post._id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100"
                        title="Delete thread"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW 3: ANALYTICS & INSIGHTS (REPLACING BLACKTWIST)             */}
      {/* ============================================================== */}
      {subTab === 'analytics' && (
        <div className="space-y-6">
          {/* Account Filter Bar */}
          <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Account Filter:</span>
              <select
                value={analyticsAccountFilter}
                onChange={(e) => setAnalyticsAccountFilter(e.target.value)}
                className="text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-xl px-3 py-1.5 outline-none"
              >
                <option value="all">All Accounts (Consolidated)</option>
                {accounts.map((acc) => (
                  <option key={acc._id || acc.userId} value={acc.username}>
                    @{acc.username} ({acc.displayName})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={fetchAnalytics}
              className="text-xs font-semibold text-slate-600 hover:text-purple-600 flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAnalytics ? 'animate-spin' : ''}`} />
              Sync Metrics
            </button>
          </div>

          {/* Hero KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Impressions
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {(analyticsData?.totals?.impressions ?? 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 font-semibold mt-1 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3 text-slate-400" /> Real-time reach
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Likes
              </div>
              <div className="text-xl font-bold text-purple-700 mt-1">
                {(analyticsData?.totals?.likes ?? 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Organic interactions</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Replies
              </div>
              <div className="text-xl font-bold text-indigo-700 mt-1">
                {(analyticsData?.totals?.replies ?? 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Conversations sparked</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Reposts
              </div>
              <div className="text-xl font-bold text-rose-700 mt-1">
                {(analyticsData?.totals?.reposts ?? 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Virality multiplier</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Eng. Rate
              </div>
              <div className="text-xl font-bold text-emerald-600 mt-1">
                {analyticsData?.totals?.avgEngagementRate ?? 0}%
              </div>
              <div className="text-[10px] text-slate-400 font-semibold mt-1">Audience engagement</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Scheduled
              </div>
              <div className="text-xl font-bold text-amber-600 mt-1">
                {analyticsData?.totals?.scheduledCount ?? postsCounts.scheduled}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Active queue</div>
            </div>
          </div>

          {/* Timeseries Graph + Strategy Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 14-Day Performance Curve (8 cols) */}
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Performance Over Time (14 Days)</h3>
                  <p className="text-xs text-slate-400">Daily impression growth and thread engagement</p>
                </div>
              </div>

              {/* Chart Visualization */}
              <div className="h-44 w-full flex items-end gap-2 pt-6 pb-2 px-1">
                {(analyticsData?.timeseries || []).map((pt: any, i: number) => {
                  const maxH = 100;
                  const barH = Math.min(100, Math.max(12, Math.floor((pt.views / 150) * maxH)));

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="w-full bg-slate-100 rounded-t-lg relative overflow-hidden flex items-end justify-center">
                        <div
                          style={{ height: `${barH}%` }}
                          className="w-full bg-gradient-to-t from-purple-600 to-fuchsia-400 rounded-t transition-all group-hover:from-purple-500 group-hover:to-fuchsia-300"
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono rotate-45 md:rotate-0 origin-left">
                        {pt.date}
                      </span>

                      {/* Tooltip */}
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-mono px-2 py-1 rounded-md shadow-lg pointer-events-none whitespace-nowrap z-20">
                        {pt.views} views • {pt.likes} likes
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Best Times to Post (4 cols) */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-500" />
                Best Time to Post Heatmap
              </h3>
              <p className="text-xs text-slate-400">
                AI analyzed peak engagement slots for Indian & International cinema
              </p>

              <div className="space-y-2 pt-1">
                {(analyticsData?.bestTimesToPost || []).map((slot: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800">{slot.hour}</div>
                      <div className="text-[10px] text-slate-500">{slot.recommendation}</div>
                    </div>
                    <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md font-mono">
                      {slot.engagementScore}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW 4: MCP SERVER & ANTIGRAVITY AI BRIDGE                     */}
      {/* ============================================================== */}
      {subTab === 'mcp' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 rounded-3xl p-6 lg:p-8 text-white border border-purple-900/50 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    MCP Server Active & Listening
                  </span>
                  <span className="text-[11px] font-semibold text-purple-300/80 px-2.5 py-1 rounded-full bg-purple-900/40 border border-purple-700/40">
                    Standard 2024-11-05
                  </span>
                  <span className="text-[11px] font-semibold text-purple-300/80 px-2.5 py-1 rounded-full bg-purple-900/40 border border-purple-700/40">
                    JSON-RPC 2.0 & SSE
                  </span>
                </div>
                <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                  <Terminal className="w-6 h-6 text-emerald-400" />
                  Threads & Instagram Model Context Protocol (MCP) Bridge
                </h2>
                <p className="text-xs text-purple-200/80 leading-relaxed">
                  Direct AI bridge enabling Antigravity, Claude, and local automation agents to create, schedule, reschedule, and monitor Threads posts and Instagram reels natively without Blacktwist or third-party subscriptions.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleTestMcp('initialize')}
                  disabled={mcpConsoleLoading}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${mcpConsoleLoading ? 'animate-spin' : ''}`} />
                  Test Handshake
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('http://localhost:3000/api/mcp');
                    setMcpCopiedUrl(true);
                    setTimeout(() => setMcpCopiedUrl(false), 2000);
                  }}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 flex items-center justify-center gap-2 transition-all"
                >
                  {mcpCopiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {mcpCopiedUrl ? 'Copied URL!' : 'Copy API URL'}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Integration Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Box 1: API Endpoint & Transports */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">HTTP & SSE MCP Endpoint</h3>
                    <p className="text-[11px] text-slate-400">Primary remote transport for Antigravity & clients</p>
                  </div>
                </div>
                {mcpPingMs !== null && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                    Ping: {mcpPingMs}ms
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  MCP Server URL (HTTP/SSE)
                </label>
                <div className="flex items-center gap-2 bg-slate-900 text-purple-300 font-mono text-xs px-3.5 py-2.5 rounded-xl border border-slate-800">
                  <span className="flex-1 truncate select-all">http://localhost:3000/api/mcp</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('http://localhost:3000/api/mcp');
                      setMcpCopiedUrl(true);
                      setTimeout(() => setMcpCopiedUrl(false), 2000);
                    }}
                    className="p-1 hover:text-white transition-colors"
                    title="Copy URL"
                  >
                    {mcpCopiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Alternative Local Stdio Command
                </label>
                <div className="flex items-center gap-2 bg-slate-900 text-slate-300 font-mono text-xs px-3.5 py-2.5 rounded-xl border border-slate-800">
                  <span className="flex-1 truncate select-all">node scripts/mcp-server.mjs</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('node scripts/mcp-server.mjs');
                      setMcpCopiedStdio(true);
                      setTimeout(() => setMcpCopiedStdio(false), 2000);
                    }}
                    className="p-1 hover:text-white transition-colors"
                    title="Copy Command"
                  >
                    {mcpCopiedStdio ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div className="text-xs text-purple-900 leading-relaxed">
                  <span className="font-bold">No API key required locally:</span> Accepts standard requests or any optional <code className="font-mono bg-purple-100 px-1 py-0.5 rounded text-[10px]">x-api-key</code> for seamless backward compatibility with legacy Blacktwist setups.
                </div>
              </div>
            </div>

            {/* Box 2: Antigravity Config Snippet */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Antigravity Configuration</h3>
                    <p className="text-[11px] text-slate-400">File: ~/.gemini/config/mcp_config.json</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const cfg = JSON.stringify(
                      {
                        mcpServers: {
                          videotimmer: {
                            url: 'http://localhost:3000/api/mcp',
                          },
                        },
                      },
                      null,
                      2
                    );
                    navigator.clipboard.writeText(cfg);
                    setMcpCopiedConfig(true);
                    setTimeout(() => setMcpCopiedConfig(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all"
                >
                  {mcpCopiedConfig ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {mcpCopiedConfig ? 'Copied!' : 'Copy JSON'}
                </button>
              </div>

              <div className="relative bg-slate-950 text-emerald-400 p-4 rounded-2xl font-mono text-xs overflow-x-auto border border-slate-800">
                <pre>{`{
  "mcpServers": {
    "videotimmer": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}`}</pre>
              </div>

              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 leading-relaxed">
                  <span className="font-bold">Drop-in Blacktwist Replacement:</span> You can also name the server key <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded text-[10px]">blacktwist</code> in your config so existing agent prompts, scheduled routines, and memories execute instantly with 0 changes!
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Test Console */}
          <div className="bg-slate-950 rounded-3xl border border-slate-800 p-6 shadow-2xl text-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  Live MCP Test Console
                </h3>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                  POST /api/mcp
                </span>
              </div>

              {/* Console Trigger Actions */}
              <div className="flex items-center flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleTestMcp('initialize')}
                  disabled={mcpConsoleLoading}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 transition-colors"
                >
                  Handshake
                </button>
                <button
                  type="button"
                  onClick={() => handleTestMcp('tools/list')}
                  disabled={mcpConsoleLoading}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition-colors"
                >
                  tools/list
                </button>
                <button
                  type="button"
                  onClick={() => handleTestMcp('list_time_slots')}
                  disabled={mcpConsoleLoading}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors"
                >
                  Cinema Slots
                </button>
                <button
                  type="button"
                  onClick={() => handleTestMcp('list_providers')}
                  disabled={mcpConsoleLoading}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 transition-colors"
                >
                  Providers
                </button>
                <button
                  type="button"
                  onClick={() => handleTestMcp('get_live_metrics')}
                  disabled={mcpConsoleLoading}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 transition-colors"
                >
                  Metrics
                </button>
                <button
                  type="button"
                  onClick={() => handleTestMcp('list_posts', { status: 'all' })}
                  disabled={mcpConsoleLoading}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-pink-300 border border-slate-700 transition-colors"
                >
                  Posts
                </button>
              </div>
            </div>

            {/* Output Display Window */}
            <div className="bg-slate-900 rounded-2xl p-4 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto border border-slate-800/80">
              {mcpConsoleLoading ? (
                <div className="flex items-center gap-2 text-purple-400 py-6 justify-center">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Executing JSON-RPC 2.0 call to /api/mcp...</span>
                </div>
              ) : mcpConsoleOutput ? (
                <pre className="text-emerald-400 leading-relaxed">{mcpConsoleOutput}</pre>
              ) : (
                <div className="text-slate-500 py-6 text-center text-xs">
                  Click any test trigger above to verify live JSON-RPC response from the MCP server.
                </div>
              )}
            </div>
          </div>

          {/* Supported Tools Directory (13 Tools) */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Registered MCP Tools (13 Tools)</h3>
                <p className="text-xs text-slate-400">
                  Full parity with Blacktwist specifications plus native Instagram Reels additions
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 font-mono">
                13 Tools Available
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {[
                {
                  name: 'create_post',
                  category: 'Threads',
                  tag: 'Core',
                  desc: 'Creates a post or multi-post thread with text, topics, public video/image attachments, auto-repost, and scheduleAt.',
                },
                {
                  name: 'list_providers',
                  category: 'Threads',
                  tag: 'Account',
                  desc: 'Lists connected accounts with providerId, username, follower count, and avatars for agent targeting.',
                },
                {
                  name: 'list_posts',
                  category: 'Threads',
                  tag: 'Queue',
                  desc: 'Queries scheduled, published, and draft posts with date filtering (from/to) and provider isolation.',
                },
                {
                  name: 'get_thread',
                  category: 'Threads',
                  tag: 'Query',
                  desc: 'Retrieves full thread structure, child posts, current status, permalink, and scheduled time.',
                },
                {
                  name: 'reschedule_thread',
                  category: 'Threads',
                  tag: 'Schedule',
                  desc: 'Updates the publication date and time of an existing scheduled thread.',
                },
                {
                  name: 'delete_thread',
                  category: 'Threads',
                  tag: 'Delete',
                  desc: 'Removes or cancels a thread from the publication queue by ID.',
                },
                {
                  name: 'list_time_slots',
                  category: 'Analytics',
                  tag: 'Schedule',
                  desc: 'Lists the 5 daily strategic cinema posting slots (9 AM, 2 PM, 9 PM, 11 PM, 1 AM IST).',
                },
                {
                  name: 'get_best_time_to_post',
                  category: 'Analytics',
                  tag: 'AI',
                  desc: 'Calculates engagement scores and gives AI recommendations for peak cinema reach.',
                },
                {
                  name: 'get_live_metrics',
                  category: 'Analytics',
                  tag: 'Real-time',
                  desc: 'Returns live views, likes, replies, reposts, and average engagement rate.',
                },
                {
                  name: 'get_post_analytics',
                  category: 'Analytics',
                  tag: 'Post',
                  desc: 'Detailed views, likes, replies, quotes, and rate for a specific published thread.',
                },
                {
                  name: 'list_drafts',
                  category: 'Threads',
                  tag: 'Drafts',
                  desc: 'Lists all unposted drafts awaiting review or scheduling.',
                },
                {
                  name: 'create_instagram_reel',
                  category: 'Instagram',
                  tag: 'Reels',
                  desc: 'Publishes or schedules an MP4 video reel to connected Instagram business accounts.',
                },
                {
                  name: 'list_instagram_accounts',
                  category: 'Instagram',
                  tag: 'Account',
                  desc: 'Lists connected Instagram Business accounts with IDs and follower metrics.',
                },
              ].map((tool, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl border border-slate-100 hover:border-purple-200 bg-slate-50/60 hover:bg-white transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                      {tool.name}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      {tool.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{tool.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MANAGE & CONNECT ACCOUNTS MODAL                                */}
      {/* ============================================================== */}
      {isManageAccountsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-purple-600 text-white font-bold flex items-center justify-center text-sm shadow-md shadow-purple-500/20">
                  @
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Threads Multi-Account Manager</h3>
                  <p className="text-xs text-slate-400">Connect, authenticate via OAuth, or add multiple accounts</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManageAccountsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setModalTab('oauth')}
                className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  modalTab === 'oauth' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                Meta OAuth
              </button>
              <button
                type="button"
                onClick={() => setModalTab('token')}
                className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  modalTab === 'token' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                Token / Sandbox
              </button>
              <button
                type="button"
                onClick={() => setModalTab('manage')}
                className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  modalTab === 'manage' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Accounts ({accounts.length})
              </button>
            </div>

            {/* TAB 1: Meta OAuth Connect */}
            {modalTab === 'oauth' && (
              <div className="space-y-4 py-2">
                {/* Status Card */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  oauthStatus.configured
                    ? 'bg-gradient-to-tr from-purple-50 to-indigo-50 border-purple-200/80'
                    : 'bg-amber-50/80 border-amber-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className={`w-4 h-4 ${oauthStatus.configured ? 'text-purple-600' : 'text-amber-600'}`} />
                      <span className="text-xs font-bold text-slate-900">
                        {oauthStatus.configured ? 'Meta Threads OAuth 2.0 Ready' : 'Meta OAuth Setup Required'}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        oauthStatus.configured
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-300/60'
                          : 'bg-amber-100 text-amber-800 border border-amber-300/60'
                      }`}
                    >
                      {oauthStatus.configured ? 'Configured' : 'Needs Setup'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {oauthStatus.configured
                      ? 'Authenticate and link multiple Meta Threads creator or brand accounts with official Graph API v1.0 access tokens.'
                      : 'To connect live Threads accounts via OAuth, configure your Meta App ID and App Secret below or in Settings.'}
                  </p>

                  <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                    <div>
                      Redirect URI: <code className="bg-white/80 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 font-mono">http://localhost:3000/auth/threads/callback</code>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowOAuthCredentialsForm(!showOAuthCredentialsForm)}
                      className="text-xs font-bold text-purple-700 hover:text-purple-900 underline flex items-center gap-1"
                    >
                      <SettingsIcon className="w-3 h-3" />
                      {showOAuthCredentialsForm ? 'Hide Credentials Form' : 'Configure Credentials'}
                    </button>
                  </div>
                </div>

                {/* Inline Credentials Configuration Form */}
                {(!oauthStatus.configured || showOAuthCredentialsForm) && (
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-purple-600" />
                        Meta Developer App Credentials
                      </span>
                      <a
                        href="https://developers.facebook.com/apps/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-purple-600 hover:text-purple-700 flex items-center gap-1 font-semibold"
                      >
                        Meta Developer Portal <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Meta App ID</label>
                        <input
                          type="text"
                          value={oauthAppIdInput}
                          onChange={(e) => setOauthAppIdInput(e.target.value)}
                          placeholder="e.g. 104829104928"
                          className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-purple-500 bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Meta App Secret</label>
                        <input
                          type="password"
                          value={oauthAppSecretInput}
                          onChange={(e) => setOauthAppSecretInput(e.target.value)}
                          placeholder="••••••••••••••••"
                          className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-purple-500 bg-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Authorized Redirect URI</label>
                      <input
                        type="text"
                        value={oauthRedirectUriInput}
                        onChange={(e) => setOauthRedirectUriInput(e.target.value)}
                        className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-purple-500 bg-white"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={isSavingOAuthConfig}
                      onClick={handleSaveOAuthConfig}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                    >
                      {isSavingOAuthConfig ? 'Saving Credentials...' : 'Save Meta App Credentials'}
                    </button>
                  </div>
                )}

                {/* OAuth Connect Actions (when configured) */}
                {oauthStatus.configured && (
                  <div className="space-y-3 pt-1">
                    {/* Action 1: Connect Current Account */}
                    <button
                      type="button"
                      onClick={handleStartOAuth}
                      className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 transition-all"
                    >
                      <Globe className="w-4 h-4" />
                      Authorize & Connect in Current Browser
                    </button>

                    {/* Action 2: Multi-Account OAuth Workflow */}
                    <div className="p-3.5 border border-purple-200/80 rounded-2xl bg-purple-50/50 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-purple-600" />
                          Add 2nd, 3rd, or Additional Account via OAuth
                        </span>
                      </div>
                      <p className="text-[11px] text-purple-900/80 leading-relaxed">
                        Meta Threads authorizes whichever account is currently signed in on threads.net in your browser. To link another account:
                      </p>
                      <ol className="text-[11px] text-slate-600 space-y-1 list-decimal list-inside pl-1">
                        <li>Click <strong>Copy OAuth Link</strong> below.</li>
                        <li>Open a <strong>Private / Incognito window</strong> (or switch account on threads.net).</li>
                        <li>Paste the link and approve access. You will be redirected back with both accounts active!</li>
                      </ol>

                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={handleCopyOAuthUrl}
                          className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm ${
                            copiedOAuthUrl
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white hover:bg-slate-50 border border-purple-300 text-purple-700'
                          }`}
                        >
                          {copiedOAuthUrl ? (
                            <>
                              <Check className="w-4 h-4 text-white" />
                              <span>OAuth Link Copied to Clipboard!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-purple-600" />
                              <span>Copy OAuth URL for Additional Account</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Token / Sandbox Connect */}
            {modalTab === 'token' && (
              <div className="space-y-4 py-1">
                {/* Option A: Direct Access Token */}
                <div className="p-3.5 border border-slate-200 rounded-2xl space-y-2 bg-slate-50/60">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-purple-600" />
                    Paste Meta Long-Lived Access Token
                  </div>
                  <p className="text-[11px] text-slate-500">
                    If you generated a 60-day user token from Meta Graph API Explorer or Meta Business Suite, paste it here to connect immediately.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="THQW... or EAAB..."
                      className="flex-1 text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-purple-500 bg-white"
                    />
                    <button
                      type="button"
                      disabled={isConnectingAccount}
                      onClick={handleConnectToken}
                      className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700 shrink-0 shadow-sm transition-all"
                    >
                      {isConnectingAccount ? 'Verifying...' : 'Connect'}
                    </button>
                  </div>
                </div>

                {/* Option B: Quick Add Sandbox Account */}
                <div className="p-3.5 border border-slate-200 rounded-2xl space-y-2 bg-slate-50/60">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-purple-600" />
                    Quick Add Test / Custom Account (Sandbox)
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Add custom brand profiles (e.g. @cinemavault, @bollywoodreels) to preview multi-account workflows immediately.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={customUsername}
                      onChange={(e) => setCustomUsername(e.target.value)}
                      placeholder="@username handle"
                      className="text-xs border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-purple-500 bg-white"
                    />
                    <input
                      type="text"
                      value={customDisplayName}
                      onChange={(e) => setCustomDisplayName(e.target.value)}
                      placeholder="Display Name"
                      className="text-xs border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-purple-500 bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isConnectingAccount}
                    onClick={handleAddCustomAccount}
                    className="w-full py-2 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition-all shadow-sm"
                  >
                    + Add Sandbox Account
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: Manage Accounts List */}
            {modalTab === 'manage' && (
              <div className="space-y-3 py-1 max-h-80 overflow-y-auto pr-1">
                {accounts.map((acc) => {
                  const isCurrent = acc._id === selectedAccount._id || acc.userId === selectedAccount.userId;
                  const isLoadingAction = actionLoadingAccountId === acc._id;

                  return (
                    <div
                      key={acc._id || acc.userId}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white flex flex-col gap-2.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center shrink-0 text-base shadow-xs">
                            @
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <span className="truncate">@{acc.username}</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded-full uppercase font-bold shrink-0 ${
                                  acc.isSimulated
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {acc.isSimulated ? 'Sandbox' : 'Meta OAuth'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {acc.displayName} • {acc.followerCount?.toLocaleString() || 0} followers
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAccountId(acc._id || acc.userId);
                              setIsManageAccountsModalOpen(false);
                            }}
                            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                              isCurrent
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {isCurrent ? 'Active Account' : 'Switch To'}
                          </button>

                          {accounts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDisconnectAccount(acc._id, acc.username)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                              title="Disconnect account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Token Status & Actions Bar */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${acc.isSimulated ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                          <span>
                            {acc.isSimulated
                              ? 'Simulation Mode'
                              : 'OAuth Token Active'}
                          </span>
                        </div>

                        {!acc.isSimulated && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isLoadingAction}
                              onClick={() => handleSyncAccount(acc._id, acc.username)}
                              className="text-[11px] font-semibold text-slate-600 hover:text-purple-600 flex items-center gap-1"
                              title="Sync followers and profile from Meta Graph API"
                            >
                              <RefreshCw className={`w-3 h-3 ${isLoadingAction ? 'animate-spin' : ''}`} />
                              Sync Profile
                            </button>

                            <button
                              type="button"
                              disabled={isLoadingAction}
                              onClick={() => handleRefreshToken(acc._id, acc.username)}
                              className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                              title="Extend token validity for another 60 days via Meta API"
                            >
                              <Zap className="w-3 h-3 text-amber-500" />
                              Extend (+60d)
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Bottom Add Actions */}
                <div className="pt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setModalTab('oauth')}
                    className="flex-1 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    + Connect via Meta OAuth
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab('token')}
                    className="flex-1 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <Key className="w-3.5 h-3.5" />
                    + Add Token / Sandbox
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Video Picker Modal */}
      {isVideoPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Video className="w-4 h-4 text-purple-600" />
                Select Video from Rendered Parts
              </h3>
              <button
                type="button"
                onClick={() => setIsVideoPickerOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {isLoadingVideos ? (
                <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
                  Loading available video clips...
                </div>
              ) : availableVideos.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No rendered video parts found. Split a video in Studio & Splitter first.
                </div>
              ) : (
                availableVideos.map((vid) => (
                  <button
                    key={vid.id}
                    type="button"
                    onClick={() => handleSelectVideo(vid)}
                    className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="p-2 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-purple-600 group-hover:text-white transition-colors shrink-0">
                        <Video className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-slate-800 truncate">
                          {vid.title || vid.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {Math.floor(vid.duration || 0)}s • Ready to publish
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      Attach
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              Reschedule Thread
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">New Date</label>
                <input
                  type="date"
                  value={rescheduleModal.currentDate || ''}
                  onChange={(e) =>
                    setRescheduleModal((prev) => ({ ...prev, currentDate: e.target.value }))
                  }
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">New Time</label>
                <input
                  type="time"
                  value={rescheduleModal.currentTime || ''}
                  onChange={(e) =>
                    setRescheduleModal((prev) => ({ ...prev, currentTime: e.target.value }))
                  }
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-purple-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRescheduleModal({ isOpen: false })}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyReschedule}
                className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md shadow-purple-600/20"
              >
                Confirm Reschedule
              </button>
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
        onClose={() => setNotice({ isOpen: false, message: '' })}
      />
    </div>
  );
}
