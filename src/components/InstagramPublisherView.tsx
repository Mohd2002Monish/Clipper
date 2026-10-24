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
  Bookmark,
  Instagram,
  Play,
  Film,
  Image,
} from 'lucide-react';
import { NoticeModal } from './ui/NoticeModal';

export type InstagramSubTab = 'composer' | 'posts' | 'analytics';

interface InstagramPublisherViewProps {
  initialSubTab?: InstagramSubTab;
}

export interface InstagramAccountItem {
  _id: string;
  instagramUserId: string;
  username: string;
  displayName: string;
  profilePictureUrl?: string;
  biography?: string;
  followerCount?: number;
  mediaCount?: number;
  accessToken?: string;
  facebookPageId?: string;
  facebookPageName?: string;
  isActive: boolean;
  isSimulated: boolean;
  createdAt?: string;
}

interface InstagramPostRecord {
  _id: string;
  accountId: string;
  username: string;
  caption: string;
  mediaType: 'REELS' | 'VIDEO' | 'IMAGE' | 'CAROUSEL' | 'STORIES';
  mediaUrl: string;
  coverUrl?: string;
  shareToFeed?: boolean;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  scheduleAt?: string;
  publishedAt?: string;
  instagramPermalink?: string;
  error?: string;
  firstComment?: {
    enabled: boolean;
    text: string;
    status: string;
  };
  autoRepost?: {
    enabled: boolean;
    delaysHours: number[];
  };
  analytics?: {
    plays: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    reach: number;
    engagementRate: number;
  };
  createdAt?: string;
}

export function InstagramPublisherView({ initialSubTab = 'composer' }: InstagramPublisherViewProps) {
  const [subTab, setSubTab] = useState<InstagramSubTab>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) setSubTab(initialSubTab);
  }, [initialSubTab]);

  // Accounts state
  const [accounts, setAccounts] = useState<InstagramAccountItem[]>([]);
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
  const [oauthRedirectUriInput, setOauthRedirectUriInput] = useState<string>('http://localhost:3000/auth/instagram/callback');
  const [isSavingOAuthConfig, setIsSavingOAuthConfig] = useState<boolean>(false);
  const [showOAuthCredentialsForm, setShowOAuthCredentialsForm] = useState<boolean>(false);
  const [copiedOAuthUrl, setCopiedOAuthUrl] = useState<boolean>(false);

  // Active account computation (null if no accounts connected)
  const selectedAccount =
    accounts.find((a) => a._id === selectedAccountId || a.instagramUserId === selectedAccountId) ||
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
  const [mediaType, setMediaType] = useState<'REELS' | 'VIDEO' | 'IMAGE'>('REELS');
  const [caption, setCaption] = useState<string>('');
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [shareToFeed, setShareToFeed] = useState<boolean>(true);
  const [selectedVideoTitle, setSelectedVideoTitle] = useState<string>('');

  // First comment CTA state
  const [firstCommentEnabled, setFirstCommentEnabled] = useState<boolean>(true);
  const [firstCommentText, setFirstCommentText] = useState<string>(
    "I've spent 1000s of hours finding movies that most people never discover. Comment #VAULT below or DM us to get early access to our curated secret movie vault with hidden gems & mind-bending thrillers!"
  );

  // Scheduling state
  const [publishMode, setPublishMode] = useState<'schedule' | 'now' | 'draft'>('schedule');
  const [scheduleDate, setScheduleDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + (d.getHours() >= 23 ? 1 : 0));
    return d.toISOString().split('T')[0];
  });
  const [scheduleTime, setScheduleTime] = useState<string>('21:00');
  const [randomizeMinutes, setRandomizeMinutes] = useState<boolean>(true);

  // Video picker modal state
  const [isVideoPickerOpen, setIsVideoPickerOpen] = useState<boolean>(false);
  const [renderedVideos, setRenderedVideos] = useState<Array<{
    jobId: string;
    originalTitle: string;
    partIndex: number;
    totalParts: number;
    filename: string;
    downloadUrl: string;
    createdAt?: string;
  }>>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState<boolean>(false);

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // --- POSTS QUEUE STATE ---
  const [postsList, setPostsList] = useState<InstagramPostRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'published' | 'draft' | 'failed'>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingPosts, setIsLoadingPosts] = useState<boolean>(false);
  const [postsCounts, setPostsCounts] = useState<{ all: number; draft: number; scheduled: number; published: number; failed: number }>({
    all: 0,
    draft: 0,
    scheduled: 0,
    published: 0,
    failed: 0,
  });

  // Reschedule modal state
  const [rescheduleTarget, setRescheduleTarget] = useState<InstagramPostRecord | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleTime, setRescheduleTime] = useState<string>('21:00');

  // --- ANALYTICS STATE ---
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsAccountFilter, setAnalyticsAccountFilter] = useState<string>('all');
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState<boolean>(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setIsAccountDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // 1. Fetch Accounts
  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/instagram/accounts');
      const data = await res.json();
      if (data.success && data.accounts) {
        setAccounts(data.accounts);
        if (pendingSelectUsername.current) {
          const match = data.accounts.find(
            (a: InstagramAccountItem) =>
              a.username.toLowerCase() === pendingSelectUsername.current?.toLowerCase()
          );
          if (match) {
            setSelectedAccountId(match._id || match.instagramUserId);
            pendingSelectUsername.current = null;
          }
        } else if (!selectedAccountId && data.accounts.length > 0) {
          setSelectedAccountId(data.accounts[0]._id || data.accounts[0].instagramUserId);
        }
      }
    } catch {
      // Ignore
    }
  }, [selectedAccountId]);

  // 2. Fetch OAuth status
  const fetchOAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/instagram/auth');
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
      if (accountFilter !== 'all') queryParts.push(`accountId=${encodeURIComponent(accountFilter)}`);
      if (searchQuery) queryParts.push(`search=${encodeURIComponent(searchQuery)}`);

      const url = `/api/instagram/posts${queryParts.length > 0 ? `?${queryParts.join('&')}` : ''}`;
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
      const query = analyticsAccountFilter !== 'all' ? `?account=${encodeURIComponent(analyticsAccountFilter)}` : '';
      const res = await fetch(`/api/instagram/analytics${query}`);
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

  // 5. Fetch Studio Rendered Videos
  const fetchStudioRenderedVideos = async () => {
    setIsLoadingVideos(true);
    try {
      const res = await fetch('/api/history?limit=30');
      const data = await res.json();
      if (data.jobs) {
        const parts: Array<{
          jobId: string;
          originalTitle: string;
          partIndex: number;
          totalParts: number;
          filename: string;
          downloadUrl: string;
          createdAt?: string;
        }> = [];

        data.jobs.forEach((job: any) => {
          if (job.status === 'completed' && job.outputs) {
            const totalParts = job.outputs.length;
            job.outputs.forEach((out: any, pIdx: number) => {
              parts.push({
                jobId: job._id || job.id,
                originalTitle: job.originalFilename || 'Video Timmer Clip',
                partIndex: pIdx + 1,
                totalParts,
                filename: out.filename || `part_${pIdx + 1}.mp4`,
                downloadUrl: `/api/download/${job._id || job.id}/${out.partIndex || pIdx + 1}`,
                createdAt: job.createdAt,
              });
            });
          }
        });

        setRenderedVideos(parts);
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
      if (params.get('instagramConnected') === 'true') {
        const u = params.get('username') || 'Account';
        pendingSelectUsername.current = u;
        setNotice({
          isOpen: true,
          title: 'Instagram Account Connected!',
          message: `Successfully connected @${u} via Meta Instagram OAuth. You can now compose, schedule, and publish Reels!`,
          type: 'success',
        });
        window.history.replaceState({}, '', '/?tab=instagram-composer');
      } else if (params.get('instagramError')) {
        setNotice({
          isOpen: true,
          title: 'Instagram OAuth Error',
          message: params.get('instagramError') || 'Failed to authenticate with Meta Instagram.',
          type: 'error',
        });
        window.history.replaceState({}, '', '/?tab=instagram-composer');
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

  // Handle Preset Time Slots
  const applyPresetSlot = (timeStr: string) => {
    setScheduleTime(timeStr);
    const d = new Date();
    const [hours, mins] = timeStr.split(':').map(Number);
    const nowHours = d.getHours();
    const nowMins = d.getMinutes();

    if (nowHours > hours || (nowHours === hours && nowMins >= mins)) {
      d.setDate(d.getDate() + 1);
    }
    setScheduleDate(d.toISOString().split('T')[0]);
  };

  // Insert Creator Hooks
  const handleInsertHook = (hookText: string) => {
    setCaption((prev) => (prev ? `${hookText}\n\n${prev}` : `${hookText}\n\n`));
  };

  // Insert Hashtag Bundle
  const handleInsertHashtags = (tags: string) => {
    setCaption((prev) => (prev ? `${prev}\n\n${tags}` : tags));
  };

  // Select Video Part from Studio
  const handleSelectVideo = (video: { downloadUrl: string; originalTitle: string; partIndex: number; totalParts: number }) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const absoluteVideoUrl = `${origin}${video.downloadUrl}`;
    setMediaUrl(absoluteVideoUrl);
    setSelectedVideoTitle(`${video.originalTitle} (Part ${video.partIndex} of ${video.totalParts})`);
    setIsVideoPickerOpen(false);
  };

  // Submit Reel / Post
  const handleSubmitPost = async () => {
    if (!selectedAccount) {
      setNotice({
        isOpen: true,
        title: 'Account Required',
        message: 'Please connect an Instagram account before scheduling or publishing Reels.',
        type: 'warning',
      });
      return;
    }

    if (!caption.trim() && !mediaUrl) {
      setNotice({
        isOpen: true,
        title: 'Content Required',
        message: 'Please provide either a Reel video / media URL or write a caption.',
        type: 'warning',
      });
      return;
    }

    if (mediaType === 'REELS' && !mediaUrl) {
      setNotice({
        isOpen: true,
        title: 'Video Required for Reel',
        message: 'Please select a rendered video part or provide a direct video URL to publish an Instagram Reel.',
        type: 'warning',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let finalScheduleAt: string | undefined = undefined;

      if (publishMode === 'schedule') {
        let [hours, mins] = scheduleTime.split(':').map(Number);
        if (randomizeMinutes) {
          const delta = Math.floor(Math.random() * 21) - 10; // -10 to +10 mins
          mins += delta;
          if (mins < 0) {
            mins += 60;
            hours = (hours - 1 + 24) % 24;
          } else if (mins >= 60) {
            mins -= 60;
            hours = (hours + 1) % 24;
          }
        }

        const scheduledDt = new Date(`${scheduleDate}T${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`);
        finalScheduleAt = scheduledDt.toISOString();
      }

      const payload = {
        accountId: selectedAccount._id || selectedAccount.instagramUserId,
        username: selectedAccount.username,
        caption: caption.trim(),
        mediaType,
        mediaUrl: mediaUrl.trim(),
        coverUrl: coverUrl.trim() || undefined,
        shareToFeed,
        status: publishMode === 'now' ? 'publishing' : publishMode === 'schedule' ? 'scheduled' : 'draft',
        scheduleAt: finalScheduleAt,
        firstComment: firstCommentEnabled && firstCommentText.trim()
          ? { enabled: true, text: firstCommentText.trim() }
          : undefined,
        autoRepost: { enabled: true, delaysHours: [168, 336] },
        videoSource: {
          sourceType: mediaUrl.includes('/api/download/') ? 'part' : mediaUrl ? 'local' : 'none',
          filename: selectedVideoTitle || undefined,
        },
      };

      const res = await fetch('/api/instagram/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit Instagram post');
      }

      if (publishMode === 'now') {
        setNotice({
          isOpen: true,
          title: 'Reel Published!',
          message: data.permalink
            ? `Your Reel is live on Instagram: ${data.permalink}`
            : 'Reel successfully published to Instagram!',
          type: 'success',
        });
      } else if (publishMode === 'schedule') {
        setNotice({
          isOpen: true,
          title: 'Reel Scheduled!',
          message: `Scheduled for ${new Date(finalScheduleAt!).toLocaleString()} with anti-detection randomization.`,
          type: 'success',
        });
      } else {
        setNotice({
          isOpen: true,
          title: 'Draft Saved',
          message: 'Saved to your drafts folder.',
          type: 'info',
        });
      }

      // Reset form
      setCaption('');
      setMediaUrl('');
      setCoverUrl('');
      setSelectedVideoTitle('');
      fetchPosts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ isOpen: true, title: 'Submission Failed', message: msg, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Instant Manual Publish from Queue
  const handlePublishNow = async (postId: string) => {
    try {
      const res = await fetch(`/api/instagram/posts/${postId}/publish`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setNotice({
          isOpen: true,
          title: 'Reel Published!',
          message: data.permalink
            ? `Reel is live: ${data.permalink}`
            : 'Successfully released Reel to Instagram!',
          type: 'success',
        });
        fetchPosts();
        fetchAnalytics();
      } else {
        throw new Error(data.error || 'Failed to publish');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ isOpen: true, title: 'Publish Failed', message: msg, type: 'error' });
    }
  };

  // Delete Post from Queue
  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this Instagram post?')) return;
    try {
      const res = await fetch(`/api/instagram/posts/${postId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setNotice({ isOpen: true, title: 'Deleted', message: 'Post removed from queue.', type: 'info' });
        fetchPosts();
      }
    } catch {
      // Ignore
    }
  };

  // Reschedule Post
  const handleSaveReschedule = async () => {
    if (!rescheduleTarget) return;
    try {
      const scheduledDt = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
      const res = await fetch(`/api/instagram/posts/${rescheduleTarget._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleAt: scheduledDt.toISOString(),
          status: 'scheduled',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotice({
          isOpen: true,
          title: 'Rescheduled!',
          message: `Reel moved to ${scheduledDt.toLocaleString()}.`,
          type: 'success',
        });
        setRescheduleTarget(null);
        fetchPosts();
      }
    } catch {
      // Ignore
    }
  };

  // Trigger Cron Cycle
  const handleTriggerCycle = async () => {
    try {
      const res = await fetch('/api/instagram/cron', { method: 'POST' });
      const data = await res.json();
      setNotice({
        isOpen: true,
        title: 'Scheduler Run Completed',
        message: `Published: ${data.published}, Failed: ${data.failed}`,
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
          'To connect directly via Meta OAuth, add INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET in your environment or Settings.',
        type: 'warning',
      });
    }
  };

  // Connect via Direct Meta Token
  const handleConnectToken = async () => {
    if (!tokenInput.trim()) {
      setNotice({ isOpen: true, title: 'Token Required', message: 'Please enter your Meta Instagram Access Token.', type: 'warning' });
      return;
    }
    setIsConnectingAccount(true);
    try {
      const res = await fetch('/api/instagram/accounts', {
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
        setSelectedAccountId(data.account._id || data.account.instagramUserId);
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
      const res = await fetch('/api/instagram/accounts', {
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
          message: `Added @${data.account.username} to your Instagram accounts.`,
          type: 'success',
        });
        setCustomUsername('');
        setCustomDisplayName('');
        setCustomBio('');
        fetchAccounts();
        setSelectedAccountId(data.account._id || data.account.instagramUserId);
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
      const res = await fetch(`/api/instagram/accounts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setNotice({ isOpen: true, title: 'Disconnected', message: `@${username} was removed.`, type: 'info' });
        fetchAccounts();
      }
    } catch {
      // Ignore
    }
  };

  // Save Meta Instagram OAuth App Credentials
  const handleSaveOAuthConfig = async () => {
    if (!oauthAppIdInput.trim()) {
      setNotice({ isOpen: true, title: 'App ID Required', message: 'Please enter your Meta App ID.', type: 'warning' });
      return;
    }
    setIsSavingOAuthConfig(true);
    try {
      const res = await fetch('/api/instagram/auth', {
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
          message: 'Meta Instagram App credentials successfully saved! You can now authorize accounts.',
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
        message: 'Open this link in an Incognito / Private window or another browser where your second Instagram account is logged in. Once approved, it will automatically connect both accounts!',
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
      const res = await fetch(`/api/instagram/accounts/${accountId}`, {
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
      const res = await fetch(`/api/instagram/accounts/${accountId}`, {
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
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/25">
              <Instagram className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">Instagram Reels & Post Studio</h1>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-400 border border-pink-500/30">
                  Meta Graph API
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Auto-reframe, schedule 9:16 vertical Reels, auto-comment CTAs, and analyze engagement
              </p>
            </div>
          </div>

          {/* Account Dropdown Switcher */}
          <div className="flex items-center gap-2 relative">
            <div ref={accountDropdownRef} className="relative">
              {selectedAccount ? (
                <button
                  type="button"
                  onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-200 transition-all shadow-sm group"
                >
                  <div className="h-6 w-6 rounded-lg bg-gradient-to-tr from-amber-500 to-pink-600 text-white font-bold flex items-center justify-center text-[10px] shadow-sm">
                    @
                  </div>
                  <div className="text-left">
                    <div className="font-semibold flex items-center gap-1">
                      <span>@{selectedAccount.username}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {selectedAccount.followerCount?.toLocaleString() || 0} followers
                    </div>
                  </div>
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
                  className="flex items-center gap-1.5 bg-pink-900/40 hover:bg-pink-900/60 border border-pink-600/50 px-2.5 py-1.5 rounded-xl text-xs transition-all shadow-sm text-pink-300 font-medium"
                >
                  <Instagram className="w-3.5 h-3.5 text-pink-400" />
                  <span>No Account Connected</span>
                  <span className="text-[10px] bg-pink-500/20 text-pink-300 border border-pink-500/30 px-1.5 py-0.2 rounded font-bold uppercase ml-1">
                    Connect
                  </span>
                </button>
              )}

              {/* Account Switcher Dropdown */}
              {isAccountDropdownOpen && selectedAccount && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 text-slate-200 animate-in fade-in slide-in-from-top-1">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>Switch Account ({accounts.length})</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountDropdownOpen(false);
                        setIsManageAccountsModalOpen(true);
                      }}
                      className="text-pink-400 hover:text-pink-300 font-semibold text-[10px]"
                    >
                      Manage All
                    </button>
                  </div>

                  <div className="space-y-1 max-h-56 overflow-y-auto">
                    {accounts.map((acc) => {
                      const isCurrent = acc._id === selectedAccount._id || acc.instagramUserId === selectedAccount.instagramUserId;
                      return (
                        <button
                          key={acc._id || acc.instagramUserId}
                          type="button"
                          onClick={() => {
                            setSelectedAccountId(acc._id || acc.instagramUserId);
                            setIsAccountDropdownOpen(false);
                          }}
                          className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-colors ${
                            isCurrent ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white font-semibold' : 'hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                              @
                            </div>
                            <div className="truncate">
                              <div className="text-xs truncate">@{acc.username}</div>
                              <div className={`text-[10px] truncate ${isCurrent ? 'text-pink-100' : 'text-slate-400'}`}>
                                {acc.displayName || 'Instagram Creator'}
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
                      className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-800 text-pink-400 hover:text-pink-300 text-xs font-semibold flex items-center gap-2"
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
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl">
            <button
              onClick={() => setSubTab('composer')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                subTab === 'composer'
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              Reels & Post Composer
            </button>
            <button
              onClick={() => setSubTab('posts')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                subTab === 'posts'
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
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
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Reels & Insights
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* VIEW 1: COMPOSER & SCHEDULER                                   */}
      {/* ============================================================== */}
      {subTab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Reel & Caption Builder (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Active Account Identity Strip & Quick Switcher */}
            {!selectedAccount ? (
              <div className="p-4 bg-pink-50/80 border border-pink-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-pink-100 text-pink-700 font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                    <Instagram className="w-5 h-5 text-pink-600" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">No Instagram Account Connected</div>
                    <div className="text-[11px] text-slate-500">
                      Connect your Instagram Professional or Creator account to compose, schedule, and publish Reels.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsManageAccountsModalOpen(true);
                    setModalTab('oauth');
                  }}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-xs font-bold shrink-0 transition-all shadow-sm flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Connect Account</span>
                </button>
              </div>
            ) : (
              <div className="p-3 bg-gradient-to-r from-pink-50 via-purple-50/50 to-white border border-pink-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-amber-500 to-pink-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                    @
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        Publishing as <strong className="text-pink-700 font-extrabold">@{selectedAccount.username}</strong>
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
                      value={selectedAccount._id || selectedAccount.instagramUserId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="text-xs font-bold bg-white border border-pink-200 text-pink-900 rounded-xl px-2.5 py-1.5 shadow-xs outline-none focus:ring-2 focus:ring-pink-400"
                      title="Switch publishing account"
                    >
                      {accounts.map((acc) => (
                        <option key={acc._id || acc.instagramUserId} value={acc._id || acc.instagramUserId}>
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
                    className="text-xs font-bold text-pink-700 hover:text-pink-800 bg-white hover:bg-pink-50 border border-pink-200 px-2.5 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
                    title="Connect multiple Instagram accounts via OAuth"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Add Account</span>
                  </button>
                </div>
              </div>
            )}

            {/* Media Format Picker */}
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setMediaType('REELS')}
                className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  mediaType === 'REELS'
                    ? 'bg-white text-pink-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Reel (9:16 Vertical)</span>
              </button>
              <button
                type="button"
                onClick={() => setMediaType('VIDEO')}
                className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  mediaType === 'VIDEO'
                    ? 'bg-white text-pink-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Feed Video (1:1 / 4:5)</span>
              </button>
              <button
                type="button"
                onClick={() => setMediaType('IMAGE')}
                className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  mediaType === 'IMAGE'
                    ? 'bg-white text-pink-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Image className="w-3.5 h-3.5" />
                <span>Photo / Carousel</span>
              </button>
            </div>

            {/* Media Attachment Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-pink-600" />
                  Video Media Source
                </span>
                <button
                  type="button"
                  onClick={() => {
                    fetchStudioRenderedVideos();
                    setIsVideoPickerOpen(true);
                  }}
                  className="text-xs font-bold text-pink-600 hover:text-pink-700 hover:bg-pink-50 px-2.5 py-1 rounded-lg border border-pink-200 transition-all flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Pick from Studio Splits
                </button>
              </div>

              {selectedVideoTitle && (
                <div className="p-2.5 bg-pink-50/70 border border-pink-200 rounded-xl flex items-center justify-between text-xs text-pink-900">
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-4 h-4 text-pink-600 shrink-0" />
                    <span className="font-semibold truncate">{selectedVideoTitle}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVideoTitle('');
                      setMediaUrl('');
                    }}
                    className="text-pink-600 hover:text-pink-800 p-0.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Direct Video URL (MP4 / MOV)</label>
                <input
                  type="text"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://... or choose from Studio Splits above"
                  className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-pink-500"
                />
              </div>

              {mediaType === 'REELS' && (
                <div className="flex items-center justify-between pt-1 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                    <input
                      type="checkbox"
                      checked={shareToFeed}
                      onChange={(e) => setShareToFeed(e.target.checked)}
                      className="rounded text-pink-600 focus:ring-pink-500"
                    />
                    <span>Also share to Main Profile Grid (Recommend)</span>
                  </label>
                </div>
              )}
            </div>

            {/* Caption Textarea Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">Caption & Narrative</span>
                <span className={`text-[11px] font-mono ${caption.length > 2100 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                  {caption.length} / 2,200
                </span>
              </div>

              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write an engaging Instagram Reel caption, hook, and story details..."
                rows={7}
                className="w-full text-xs text-slate-800 placeholder-slate-400 border-none outline-none resize-none leading-relaxed"
              />

              {/* Creator Fast Shortcuts */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">Fast Hooks:</span>
                <button
                  type="button"
                  onClick={() => handleInsertHook('This ending completely rewrote the entire film...')}
                  className="bg-white text-slate-700 hover:bg-pink-50 border border-slate-200 text-xs font-medium px-2.5 py-1 rounded-xl transition-all shadow-xs"
                >
                  Ending Hook
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertHook('Tag a cinema lover who still hasn’t watched this underrated masterpiece...')}
                  className="bg-white text-slate-700 hover:bg-pink-50 border border-slate-200 text-xs font-medium px-2.5 py-1 rounded-xl transition-all shadow-xs"
                >
                  Tag Hook
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertHook('Is this the greatest plot twist in Indian cinema history? Or did you predict it?')}
                  className="bg-white text-slate-700 hover:bg-pink-50 border border-slate-200 text-xs font-medium px-2.5 py-1 rounded-xl transition-all shadow-xs"
                >
                  Debate Hook
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertHashtags('#reels #cinematography #indiancinema #bollywood #moviebuff #filmmaking #reelsinstagram')}
                  className="bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200 text-xs font-semibold px-2.5 py-1 rounded-xl transition-all shadow-xs"
                >
                  + Add Cinema Tags
                </button>
              </div>
            </div>

            {/* Auto-Comment CTA (First Comment) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-pink-600" />
                  Auto-Comment First Reply (Movie Vault CTA)
                </span>
                <input
                  type="checkbox"
                  checked={firstCommentEnabled}
                  onChange={(e) => setFirstCommentEnabled(e.target.checked)}
                  className="rounded text-pink-600 focus:ring-pink-500"
                />
              </label>

              {firstCommentEnabled && (
                <div className="space-y-2 pt-1 animate-in fade-in">
                  <textarea
                    value={firstCommentText}
                    onChange={(e) => setFirstCommentText(e.target.value)}
                    rows={3}
                    className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl p-3 outline-none focus:border-pink-500 bg-slate-50/60 leading-relaxed"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Triggers DM automations & drives organic comment virality</span>
                    <button
                      type="button"
                      onClick={() =>
                        setFirstCommentText(
                          "I've spent 1000s of hours finding movies that most people never discover. Comment #VAULT below or DM us to get early access to our curated secret movie vault with hidden gems & mind-bending thrillers!"
                        )
                      }
                      className="text-pink-600 hover:text-pink-800 font-semibold"
                    >
                      Reset to Movie Vault Formula
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Scheduling & Publishing Controls (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-pink-600" />
                  Publish & Scheduling Engine
                </h3>
              </div>

              {/* Publish Mode Toggle */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPublishMode('schedule')}
                  className={`py-2 rounded-lg transition-all ${
                    publishMode === 'schedule' ? 'bg-white text-pink-600 shadow-sm font-bold' : 'text-slate-600'
                  }`}
                >
                  Schedule
                </button>
                <button
                  type="button"
                  onClick={() => setPublishMode('now')}
                  className={`py-2 rounded-lg transition-all ${
                    publishMode === 'now' ? 'bg-white text-pink-600 shadow-sm font-bold' : 'text-slate-600'
                  }`}
                >
                  Publish Now
                </button>
                <button
                  type="button"
                  onClick={() => setPublishMode('draft')}
                  className={`py-2 rounded-lg transition-all ${
                    publishMode === 'draft' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600'
                  }`}
                >
                  Save Draft
                </button>
              </div>

              {publishMode === 'schedule' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Target Date</label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-pink-500 bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Release Time</label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-pink-500 bg-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Anti-detection randomization */}
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={randomizeMinutes}
                      onChange={(e) => setRandomizeMinutes(e.target.checked)}
                      className="rounded text-pink-600 focus:ring-pink-500"
                    />
                    <span>Anti-bot jitter: randomize release time by ±10 minutes</span>
                  </label>

                  {/* 5 Daily Optimal Reels Posting Slots */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                      <span>Optimal Cinema Posting Slots</span>
                      <span className="text-[10px] text-pink-600 lowercase font-normal">1-click select</span>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyPresetSlot('09:00')}
                        className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 hover:border-pink-400 hover:bg-pink-50 text-xs font-medium text-slate-700 transition-all text-left"
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
                        className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 hover:border-pink-400 hover:bg-pink-50 text-xs font-medium text-slate-700 transition-all text-left"
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
                        className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 hover:border-pink-400 hover:bg-pink-50 text-xs font-medium text-slate-700 transition-all text-left"
                      >
                        <span className="flex items-center gap-2">
                          <Moon className="w-4 h-4 text-purple-500 shrink-0" />
                          <span>9:00 PM — Hollywood / International</span>
                        </span>
                        <span className="font-mono text-[11px] text-pink-600 font-semibold">Prime</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => applyPresetSlot('23:00')}
                        className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 hover:border-pink-400 hover:bg-pink-50 text-xs font-medium text-slate-700 transition-all text-left"
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
                        className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 hover:border-pink-400 hover:bg-pink-50 text-xs font-medium text-slate-700 transition-all text-left"
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

              {/* Main Submit Button */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmitPost}
                className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
                  publishMode === 'now'
                    ? 'bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white shadow-pink-600/30'
                    : publishMode === 'schedule'
                    ? 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white shadow-purple-600/30'
                    : 'bg-slate-800 hover:bg-slate-900 text-white'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Media...</span>
                  </>
                ) : publishMode === 'now' ? (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Publish Reel to Instagram Now</span>
                  </>
                ) : publishMode === 'schedule' ? (
                  <>
                    <Calendar className="w-4 h-4" />
                    <span>Schedule Reel for {scheduleDate}</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="w-4 h-4" />
                    <span>Save Draft to Queue</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW 2: POSTS & SCHEDULED QUEUE                                */}
      {/* ============================================================== */}
      {subTab === 'posts' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            {/* Status Filter Badges */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {(['all', 'scheduled', 'published', 'draft', 'failed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st} ({postsCounts[st] || 0})
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTriggerCycle}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                title="Force background scheduler release cycle now"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Run Scheduler Now</span>
              </button>

              <button
                type="button"
                onClick={fetchPosts}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
                title="Refresh queue"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Posts List */}
          {isLoadingPosts ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              Loading Instagram queue...
            </div>
          ) : postsList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
              <Film className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-700">No Instagram Posts Found</div>
              <p className="text-xs text-slate-400">
                You have no posts matching the current filter. Compose a Reel or schedule a clip to start!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {postsList.map((post) => (
                <div
                  key={post._id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 to-pink-600 text-white font-bold flex items-center justify-center shrink-0">
                      <Instagram className="w-5 h-5 text-white" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">@{post.username}</span>
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            post.status === 'published'
                              ? 'bg-emerald-100 text-emerald-700'
                              : post.status === 'scheduled'
                              ? 'bg-amber-100 text-amber-800'
                              : post.status === 'failed'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {post.status}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-pink-100 text-pink-800 font-semibold uppercase">
                          {post.mediaType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 line-clamp-2 max-w-xl">
                        {post.caption || '(No caption text)'}
                      </p>
                      {post.scheduleAt && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Release: {new Date(post.scheduleAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    {post.status === 'scheduled' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handlePublishNow(post._id)}
                          className="px-3 py-1.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                        >
                          Publish Now
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRescheduleTarget(post);
                            if (post.scheduleAt) {
                              const d = new Date(post.scheduleAt);
                              setRescheduleDate(d.toISOString().split('T')[0]);
                              setRescheduleTime(
                                `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                              );
                            }
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
                        >
                          Reschedule
                        </button>
                      </>
                    )}

                    {post.instagramPermalink && (
                      <a
                        href={post.instagramPermalink}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-pink-600 rounded-xl"
                        title="View Reel on Instagram"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeletePost(post._id)}
                      className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50"
                      title="Delete post"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW 3: ANALYTICS & INSIGHTS                                   */}
      {/* ============================================================== */}
      {subTab === 'analytics' && (
        <div className="space-y-6">
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Reel Plays</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {(analyticsData?.totals?.totalPlays ?? 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 font-semibold mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-slate-400" /> Video plays
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Likes</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {(analyticsData?.totals?.totalLikes ?? 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Audience likes</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Comments</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {(analyticsData?.totals?.totalComments ?? 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">CTA triggers</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Shares & Saves</div>
              <div className="text-xl font-bold text-pink-600 mt-1">
                {((analyticsData?.totals?.totalShares ?? 0) + (analyticsData?.totals?.totalSaves ?? 0)).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 font-semibold mt-1">Algorithm viral booster</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Accounts Reached</div>
              <div className="text-xl font-bold text-purple-600 mt-1">
                {(analyticsData?.totals?.totalReach ?? 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Unique accounts</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Engagement Rate</div>
              <div className="text-xl font-bold text-emerald-600 mt-1">
                {analyticsData?.totals?.avgEngagementRate ?? 0}%
              </div>
              <div className="text-[10px] text-slate-400 font-semibold mt-1">Real-time engagement</div>
            </div>
          </div>

          {/* Timeseries Graph + Best Times */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Reels Performance Over Time (14 Days)</h3>
                <p className="text-xs text-slate-400">Daily play count growth and reach trajectory</p>
              </div>

              {/* Chart Visualization */}
              <div className="h-44 w-full flex items-end gap-2 pt-6 pb-2 px-1">
                {(analyticsData?.timeseries || []).map((pt: any, i: number) => {
                  const maxH = 100;
                  const barH = Math.min(100, Math.max(14, Math.floor((pt.plays / 1500) * maxH)));

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="w-full bg-slate-100 rounded-t-lg relative overflow-hidden flex items-end justify-center">
                        <div
                          style={{ height: `${barH}%` }}
                          className="w-full bg-gradient-to-t from-pink-600 via-rose-500 to-amber-400 rounded-t transition-all group-hover:from-pink-500 group-hover:to-amber-300"
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono rotate-45 md:rotate-0 origin-left">
                        {pt.date}
                      </span>

                      {/* Tooltip */}
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-mono px-2 py-1 rounded-md shadow-lg pointer-events-none whitespace-nowrap z-20">
                        {pt.plays} plays • {pt.likes} likes
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-500" />
                Best Time to Drop Reels
              </h3>
              <p className="text-xs text-slate-400">Peak retention hours for cinema reels & movie clips</p>

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
                    <span className="text-xs font-bold text-pink-700 bg-pink-100 px-2 py-0.5 rounded-md font-mono">
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
      {/* MANAGE & CONNECT ACCOUNTS MODAL                                */}
      {/* ============================================================== */}
      {isManageAccountsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white font-bold flex items-center justify-center text-sm shadow-md shadow-pink-500/20">
                  <Instagram className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Instagram Multi-Account Manager</h3>
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
                  modalTab === 'oauth' ? 'bg-white text-pink-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                Meta OAuth
              </button>
              <button
                type="button"
                onClick={() => setModalTab('token')}
                className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  modalTab === 'token' ? 'bg-white text-pink-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                Token / Sandbox
              </button>
              <button
                type="button"
                onClick={() => setModalTab('manage')}
                className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  modalTab === 'manage' ? 'bg-white text-pink-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Accounts ({accounts.length})
              </button>
            </div>

            {/* TAB 1: Meta OAuth Connect */}
            {modalTab === 'oauth' && (
              <div className="space-y-4 py-2">
                <div
                  className={`p-4 rounded-2xl border transition-all ${
                    oauthStatus.configured
                      ? 'bg-gradient-to-tr from-pink-50 to-purple-50 border-pink-200/80'
                      : 'bg-amber-50/80 border-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className={`w-4 h-4 ${oauthStatus.configured ? 'text-pink-600' : 'text-amber-600'}`} />
                      <span className="text-xs font-bold text-slate-900">
                        {oauthStatus.configured ? 'Meta Instagram Graph API Ready' : 'Meta OAuth Setup Required'}
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
                      ? 'Authenticate and link multiple Meta Instagram creator or business accounts with official Graph API access tokens.'
                      : 'To connect live Instagram accounts via OAuth, configure your Meta App ID and App Secret below or in Settings.'}
                  </p>

                  <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                    <div>
                      Redirect URI: <code className="bg-white/80 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 font-mono">http://localhost:3000/auth/instagram/callback</code>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowOAuthCredentialsForm(!showOAuthCredentialsForm)}
                      className="text-xs font-bold text-pink-700 hover:text-pink-900 underline flex items-center gap-1"
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
                        <Key className="w-3.5 h-3.5 text-pink-600" />
                        Meta Developer App Credentials
                      </span>
                      <a
                        href="https://developers.facebook.com/apps/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-pink-600 hover:text-pink-700 flex items-center gap-1 font-semibold"
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
                          className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-pink-500 bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Meta App Secret</label>
                        <input
                          type="password"
                          value={oauthAppSecretInput}
                          onChange={(e) => setOauthAppSecretInput(e.target.value)}
                          placeholder="••••••••••••••••"
                          className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-pink-500 bg-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Authorized Redirect URI</label>
                      <input
                        type="text"
                        value={oauthRedirectUriInput}
                        onChange={(e) => setOauthRedirectUriInput(e.target.value)}
                        className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-pink-500 bg-white"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={isSavingOAuthConfig}
                      onClick={handleSaveOAuthConfig}
                      className="w-full py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
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
                      className="w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 transition-all"
                    >
                      <Globe className="w-4 h-4" />
                      Authorize & Connect in Current Browser
                    </button>

                    {/* Action 2: Multi-Account OAuth Workflow */}
                    <div className="p-3.5 border border-pink-200/80 rounded-2xl bg-pink-50/50 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-pink-950 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-pink-600" />
                          Add 2nd, 3rd, or Additional Account via OAuth
                        </span>
                      </div>
                      <p className="text-[11px] text-pink-900/80 leading-relaxed">
                        Meta authorizes whichever account is currently signed in on Facebook / Instagram in your browser. To link another account:
                      </p>
                      <ol className="text-[11px] text-slate-600 space-y-1 list-decimal list-inside pl-1">
                        <li>Click <strong>Copy OAuth Link</strong> below.</li>
                        <li>Open a <strong>Private / Incognito window</strong> (or switch account on Instagram).</li>
                        <li>Paste the link and approve access. You will be redirected back with both accounts active!</li>
                      </ol>

                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={handleCopyOAuthUrl}
                          className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm ${
                            copiedOAuthUrl
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white hover:bg-slate-50 border border-pink-300 text-pink-700'
                          }`}
                        >
                          {copiedOAuthUrl ? (
                            <>
                              <Check className="w-4 h-4 text-white" />
                              <span>OAuth Link Copied to Clipboard!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-pink-600" />
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
                    <Key className="w-3.5 h-3.5 text-pink-600" />
                    Paste Meta Long-Lived Access Token
                  </div>
                  <p className="text-[11px] text-slate-500">
                    If you generated a 60-day user/page token from Meta Graph API Explorer or Meta Business Suite, paste it here to connect immediately.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="EAAB... or IGQV..."
                      className="flex-1 text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-pink-500 bg-white"
                    />
                    <button
                      type="button"
                      disabled={isConnectingAccount}
                      onClick={handleConnectToken}
                      className="px-4 py-2 bg-pink-600 text-white text-xs font-bold rounded-xl hover:bg-pink-700 shrink-0 shadow-sm transition-all"
                    >
                      {isConnectingAccount ? 'Verifying...' : 'Connect'}
                    </button>
                  </div>
                </div>

                {/* Option B: Quick Add Sandbox Account */}
                <div className="p-3.5 border border-slate-200 rounded-2xl space-y-2 bg-slate-50/60">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-pink-600" />
                    Quick Add Test / Custom Account (Sandbox)
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Add custom brand profiles (e.g. @cinemavault_reels, @bollywoodgems) to test multi-account workflows immediately.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={customUsername}
                      onChange={(e) => setCustomUsername(e.target.value)}
                      placeholder="@username handle"
                      className="text-xs border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-pink-500 bg-white"
                    />
                    <input
                      type="text"
                      value={customDisplayName}
                      onChange={(e) => setCustomDisplayName(e.target.value)}
                      placeholder="Display Name"
                      className="text-xs border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-pink-500 bg-white"
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
                  const isCurrent = acc._id === selectedAccount._id || acc.instagramUserId === selectedAccount.instagramUserId;
                  const isLoadingAction = actionLoadingAccountId === acc._id;

                  return (
                    <div
                      key={acc._id || acc.instagramUserId}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white flex flex-col gap-2.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 to-pink-600 text-white font-bold flex items-center justify-center shrink-0 text-base shadow-xs">
                            <Instagram className="w-5 h-5 text-white" />
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
                              setSelectedAccountId(acc._id || acc.instagramUserId);
                              setIsManageAccountsModalOpen(false);
                            }}
                            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                              isCurrent
                                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-sm'
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
                            {acc.isSimulated ? 'Simulation Mode' : 'OAuth Token Active'}
                          </span>
                        </div>

                        {!acc.isSimulated && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isLoadingAction}
                              onClick={() => handleSyncAccount(acc._id, acc.username)}
                              className="text-[11px] font-semibold text-slate-600 hover:text-pink-600 flex items-center gap-1"
                              title="Sync followers and profile from Meta Graph API"
                            >
                              <RefreshCw className={`w-3 h-3 ${isLoadingAction ? 'animate-spin' : ''}`} />
                              Sync Profile
                            </button>

                            <button
                              type="button"
                              disabled={isLoadingAction}
                              onClick={() => handleRefreshToken(acc._id, acc.username)}
                              className="text-[11px] font-semibold text-pink-600 hover:text-pink-800 flex items-center gap-1"
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
                    className="flex-1 py-2 text-xs font-bold text-pink-700 bg-pink-50 hover:bg-pink-100 border border-pink-200 rounded-xl transition-all flex items-center justify-center gap-1.5"
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

      {/* Video Picker Modal (Studio Splits) */}
      {isVideoPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Film className="w-4 h-4 text-pink-600" />
                Select Rendered Clip for Instagram Reel
              </h3>
              <button
                type="button"
                onClick={() => setIsVideoPickerOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Pick a completed 9:16 vertical split part from your Studio render jobs:
            </p>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {isLoadingVideos ? (
                <div className="text-center py-8 text-xs text-slate-400">Loading rendered clips...</div>
              ) : renderedVideos.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No completed video parts found in history. Render a split in Studio first!
                </div>
              ) : (
                renderedVideos.map((vid, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-slate-200 hover:border-pink-400 bg-white hover:bg-pink-50/40 flex items-center justify-between transition-all group"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-bold text-slate-800 truncate">{vid.originalTitle}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Part {vid.partIndex} of {vid.totalParts} • {vid.filename}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectVideo(vid)}
                      className="px-3 py-1.5 bg-pink-600 text-white rounded-lg text-xs font-semibold shadow-xs hover:bg-pink-700 transition-all shrink-0"
                    >
                      Use Clip
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Reschedule Instagram Post</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase">Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-3 py-2 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase">Time</label>
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-3 py-2 outline-none font-mono"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveReschedule}
                className="flex-1 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-bold rounded-xl shadow-sm"
              >
                Save
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
        onClose={() => setNotice((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
