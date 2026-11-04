'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Facebook,
  Film,
  Video,
  FileText,
  Clock,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Plus,
  Trash2,
  Calendar,
  Send,
  RefreshCw,
  Eye,
  ExternalLink,
  ChevronDown,
  Sparkles,
  MessageSquare,
  Share2,
  ThumbsUp,
  Sliders,
  Upload,
  FolderOpen,
  X,
  Play,
  RotateCw,
} from 'lucide-react';
import { NoticeModal } from '@/components/ui/NoticeModal';

export interface FacebookAccountRecord {
  _id: string;
  pageId: string;
  pageName: string;
  category?: string;
  pictureUrl?: string;
  followerCount?: number;
  fanCount?: number;
  isActive: boolean;
  isSimulated: boolean;
  tokenExpiry?: string;
}

export interface FacebookPostRecord {
  _id: string;
  accountId: string;
  pageId: string;
  pageName: string;
  message: string;
  title?: string;
  postType: 'REEL' | 'VIDEO' | 'PHOTO' | 'POST';
  mediaUrl?: string;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  scheduleAt?: string;
  publishedAt?: string;
  facebookVideoId?: string;
  facebookPostId?: string;
  facebookPermalink?: string;
  error?: string;
  firstComment?: {
    enabled: boolean;
    text: string;
    status: 'pending' | 'published' | 'failed';
    commentId?: string;
  };
  analytics?: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    reach: number;
    engagementRate: number;
  };
  createdAt?: string;
}

interface FacebookPublisherViewProps {
  initialSubTab?: 'composer' | 'posts' | 'analytics';
}

export function FacebookPublisherView({ initialSubTab = 'composer' }: FacebookPublisherViewProps) {
  const [subTab, setSubTab] = useState<'composer' | 'posts' | 'analytics'>(initialSubTab);

  // Notice modal state
  const [notice, setNotice] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  // Accounts state
  const [accounts, setAccounts] = useState<FacebookAccountRecord[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<FacebookAccountRecord | null>(null);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState<boolean>(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState<boolean>(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);

  // OAuth & Setup state
  const [oauthConfigured, setOauthConfigured] = useState<boolean>(false);
  const [oauthAppId, setOauthAppId] = useState<string>('');
  const [isCustomAccountModalOpen, setIsCustomAccountModalOpen] = useState<boolean>(false);
  const [customPageId, setCustomPageId] = useState<string>('');
  const [customPageName, setCustomPageName] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('Cinema & Entertainment');
  const [customToken, setCustomToken] = useState<string>('');

  // Composer state
  const [postType, setPostType] = useState<'REEL' | 'VIDEO' | 'POST'>('REEL');
  const [postTitle, setPostTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [selectedVideoTitle, setSelectedVideoTitle] = useState<string>('');
  const [uploadedSavedFilename, setUploadedSavedFilename] = useState<string>('');
  const [selectedVideoSize, setSelectedVideoSize] = useState<number | null>(null);
  const [isUploadingLocalVideo, setIsUploadingLocalVideo] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // First comment CTA state
  const [firstCommentEnabled, setFirstCommentEnabled] = useState<boolean>(true);
  const [firstCommentText, setFirstCommentText] = useState<string>(
    "I've spent 1000s of hours finding movies that most people never discover. Comment #VAULT below or message us to get early access to our curated secret movie vault with hidden gems & mind-bending thrillers!"
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
  const [renderedVideos, setRenderedVideos] = useState<
    Array<{
      jobId: string;
      originalTitle: string;
      partIndex: number;
      totalParts: number;
      filename: string;
      downloadUrl: string;
      createdAt?: string;
    }>
  >([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Posts Queue state
  const [postsList, setPostsList] = useState<FacebookPostRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'published' | 'draft' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingPosts, setIsLoadingPosts] = useState<boolean>(false);
  const [postsCounts, setPostsCounts] = useState<{
    all: number;
    draft: number;
    scheduled: number;
    published: number;
    failed: number;
  }>({
    all: 0,
    draft: 0,
    scheduled: 0,
    published: 0,
    failed: 0,
  });

  // Reschedule modal state
  const [rescheduleTarget, setRescheduleTarget] = useState<FacebookPostRecord | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleTime, setRescheduleTime] = useState<string>('21:00');

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<any>(null);
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

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    setIsLoadingAccounts(true);
    try {
      const res = await fetch('/api/facebook/accounts');
      const data = await res.json();
      if (data.success && Array.isArray(data.accounts)) {
        setAccounts(data.accounts);
        if (data.accounts.length > 0) {
          setSelectedAccount((prev) => {
            if (prev) {
              const matched = data.accounts.find((a: any) => a._id === prev._id || a.pageId === prev.pageId);
              if (matched) return matched;
            }
            return data.accounts[0];
          });
        }
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoadingAccounts(false);
    }
  }, []);

  // Fetch OAuth Status
  const fetchOAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/facebook/auth');
      const data = await res.json();
      if (data.success) {
        setOauthConfigured(!!data.configured);
        setOauthAppId(data.appId || '');
      }
    } catch {
      // Graceful fallback
    }
  }, []);

  // Fetch Posts Queue
  const fetchPosts = useCallback(async () => {
    setIsLoadingPosts(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (selectedAccount?.pageId) params.append('pageId', selectedAccount.pageId);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`/api/facebook/posts?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setPostsList(data.posts || []);
        if (data.counts) setPostsCounts(data.counts);
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoadingPosts(false);
    }
  }, [statusFilter, selectedAccount, searchQuery]);

  // Fetch Analytics
  const fetchAnalytics = useCallback(async () => {
    setIsLoadingAnalytics(true);
    try {
      const pageId = selectedAccount?.pageId || 'all';
      const res = await fetch(`/api/facebook/analytics?pageId=${pageId}`);
      const data = await res.json();
      if (data.success && data.analytics) {
        setAnalyticsData(data.analytics);
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [selectedAccount]);

  // Fetch Rendered Videos from VideoTimmer Jobs
  const fetchRenderedVideos = async () => {
    setIsLoadingVideos(true);
    try {
      const res = await fetch('/api/jobs?limit=50&status=completed');
      const data = await res.json();
      if (data.success && Array.isArray(data.jobs)) {
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
      // Graceful fallback
    } finally {
      setIsLoadingVideos(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchAccounts();
    fetchOAuthStatus();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('facebookWarning') === 'no_pages_found') {
        setNotice({
          isOpen: true,
          title: 'No Facebook Pages Found',
          message:
            'Facebook login was successful, but Meta found 0 Facebook Pages managed by this account. Please verify that your Facebook profile is an Administrator of a Facebook Page and that you selected it during the login prompt.',
          type: 'warning',
        });
        window.history.replaceState({}, '', '/?tab=facebook-composer');
      } else if (params.get('facebookConnected') === 'true') {
        const page = params.get('pageName') || 'Page';
        setNotice({
          isOpen: true,
          title: 'Facebook Page Connected!',
          message: `Successfully connected ${page} via Facebook Login. You can now compose, schedule, and publish Facebook Reels and videos!`,
          type: 'success',
        });
        window.history.replaceState({}, '', '/?tab=facebook-composer');
        fetchAccounts();
      } else if (params.get('facebookError')) {
        setNotice({
          isOpen: true,
          title: 'Facebook OAuth Error',
          message: params.get('facebookError') || 'Failed to authenticate with Meta Facebook.',
          type: 'error',
        });
        window.history.replaceState({}, '', '/?tab=facebook-composer');
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
    setMessage((prev) => (prev ? `${hookText}\n\n${prev}` : `${hookText}\n\n`));
  };

  // Insert Hashtag Bundle
  const handleInsertHashtags = (tags: string) => {
    setMessage((prev) => (prev ? `${prev}\n\n${tags}` : tags));
  };

  // Handle local file selection from PC
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';
    setIsUploadingLocalVideo(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload/direct', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload video from local PC.');
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const absoluteUrl = `${origin}${data.downloadUrl}`;
      setMediaUrl(absoluteUrl);
      setSelectedVideoTitle(data.originalFilename || file.name);
      setUploadedSavedFilename(data.savedFilename || '');
      if (data.sizeBytes) {
        setSelectedVideoSize(data.sizeBytes);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({
        isOpen: true,
        title: 'Video Selection Failed',
        message: msg,
        type: 'error',
      });
    } finally {
      setIsUploadingLocalVideo(false);
    }
  };

  const handleClearSelectedVideo = () => {
    setSelectedVideoTitle('');
    setUploadedSavedFilename('');
    setSelectedVideoSize(null);
    setMediaUrl('');
  };

  // Select Video Part from Studio Splits
  const handleSelectVideo = (video: {
    downloadUrl: string;
    originalTitle: string;
    partIndex: number;
    totalParts: number;
  }) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const absoluteVideoUrl = `${origin}${video.downloadUrl}`;
    setMediaUrl(absoluteVideoUrl);
    setSelectedVideoTitle(`${video.originalTitle} (Part ${video.partIndex} of ${video.totalParts})`);
    setIsVideoPickerOpen(false);
  };

  // Submit Facebook Post / Reel
  const handleSubmitPost = async () => {
    if (!selectedAccount) {
      setNotice({
        isOpen: true,
        title: 'Page Required',
        message: 'Please connect a Facebook Page before scheduling or publishing.',
        type: 'warning',
      });
      return;
    }

    if (!message.trim() && !mediaUrl) {
      setNotice({
        isOpen: true,
        title: 'Content Required',
        message: 'Please provide either a video URL or write a post description.',
        type: 'warning',
      });
      return;
    }

    if (postType === 'REEL' && !mediaUrl) {
      setNotice({
        isOpen: true,
        title: 'Video Required for Reel',
        message: 'Please choose a video file from your PC or pick from Studio Splits to publish a Reel.',
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
          const delta = Math.floor(Math.random() * 21) - 10;
          mins += delta;
          if (mins < 0) {
            mins += 60;
            hours = (hours - 1 + 24) % 24;
          } else if (mins >= 60) {
            mins -= 60;
            hours = (hours + 1) % 24;
          }
        }
        const scheduledDt = new Date(
          `${scheduleDate}T${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`
        );
        finalScheduleAt = scheduledDt.toISOString();
      }

      const payload = {
        accountId: selectedAccount._id,
        pageId: selectedAccount.pageId,
        pageName: selectedAccount.pageName,
        message: message.trim(),
        title: postTitle.trim() || undefined,
        postType,
        mediaUrl: mediaUrl.trim(),
        status: publishMode === 'now' ? 'publishing' : publishMode === 'schedule' ? 'scheduled' : 'draft',
        scheduleAt: finalScheduleAt,
        firstComment:
          firstCommentEnabled && firstCommentText.trim()
            ? { enabled: true, text: firstCommentText.trim() }
            : undefined,
        autoRepost: { enabled: true, delaysHours: [168, 336] },
        videoSource: {
          sourceType: mediaUrl.includes('/api/download/') ? 'part' : mediaUrl ? 'local' : 'none',
          filename: uploadedSavedFilename || selectedVideoTitle || undefined,
        },
      };

      const res = await fetch('/api/facebook/posts', {
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
            ? `Server processing error (${res.status}). The operation timed out or failed on the server.`
            : `Server returned non-JSON response (${res.status}): ${text.slice(0, 100)}`
        );
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit Facebook post');
      }

      if (publishMode === 'now') {
        setNotice({
          isOpen: true,
          title: 'Post Published!',
          message: data.permalink
            ? `Your post is live on Facebook: ${data.permalink}`
            : 'Post successfully published to Facebook Page!',
          type: 'success',
        });
      } else if (publishMode === 'schedule') {
        setNotice({
          isOpen: true,
          title: 'Post Scheduled!',
          message: `Scheduled for ${new Date(finalScheduleAt!).toLocaleString()} with anti-detection timing.`,
          type: 'success',
        });
      } else {
        setNotice({
          isOpen: true,
          title: 'Draft Saved',
          message: 'Saved to your Facebook drafts folder.',
          type: 'info',
        });
      }

      // Reset form
      setMessage('');
      setPostTitle('');
      setMediaUrl('');
      setSelectedVideoTitle('');
      setUploadedSavedFilename('');
      setSelectedVideoSize(null);
      fetchPosts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ isOpen: true, title: 'Submission Failed', message: msg, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct Publish from Queue
  const handlePublishNow = async (post: FacebookPostRecord) => {
    try {
      const res = await fetch(`/api/facebook/posts/${post._id}/publish`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setNotice({
          isOpen: true,
          title: 'Published to Facebook!',
          message: data.permalink
            ? `Post is now live: ${data.permalink}`
            : 'Post successfully published to Facebook Page!',
          type: 'success',
        });
        fetchPosts();
      } else {
        throw new Error(data.error || 'Failed to publish post');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ isOpen: true, title: 'Publishing Failed', message: msg, type: 'error' });
    }
  };

  // Delete Post
  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post from the queue?')) return;
    try {
      const res = await fetch(`/api/facebook/posts/${postId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setPostsList((prev) => prev.filter((p) => p._id !== postId));
      }
    } catch {
      // Graceful fallback
    }
  };

  // Save Reschedule
  const handleSaveReschedule = async () => {
    if (!rescheduleTarget || !rescheduleDate) return;
    try {
      const scheduledDt = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
      const res = await fetch(`/api/facebook/posts/${rescheduleTarget._id}`, {
        method: 'PATCH',
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
          message: `Post rescheduled for ${scheduledDt.toLocaleString()}`,
          type: 'success',
        });
        setRescheduleTarget(null);
        fetchPosts();
      }
    } catch {
      // Graceful fallback
    }
  };

  // Connect Custom Page
  const handleSaveCustomAccount = async () => {
    if (!customPageName.trim()) {
      setNotice({
        isOpen: true,
        title: 'Page Name Required',
        message: 'Please provide a Facebook Page name.',
        type: 'warning',
      });
      return;
    }

    try {
      const res = await fetch('/api/facebook/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'custom',
          pageId: customPageId.trim() || `fb_${Date.now()}`,
          pageName: customPageName.trim(),
          category: customCategory.trim(),
          accessToken: customToken.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNotice({
          isOpen: true,
          title: 'Facebook Page Added!',
          message: `Page "${customPageName}" is ready for publishing.`,
          type: 'success',
        });
        setIsCustomAccountModalOpen(false);
        setCustomPageId('');
        setCustomPageName('');
        setCustomToken('');
        fetchAccounts();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ isOpen: true, title: 'Failed to Add Page', message: msg, type: 'error' });
    }
  };

  // Trigger Facebook Login OAuth
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const handleSyncPages = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/facebook/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success && Array.isArray(data.accounts) && data.accounts.length > 0) {
        setAccounts(data.accounts);
        setSelectedAccount(data.accounts[0]);
        setNotice({
          isOpen: true,
          title: 'Facebook Pages Synced',
          message: `Successfully connected ${data.accounts.length} Facebook Page(s): ${data.accounts
            .map((a: any) => a.pageName)
            .join(', ')}.`,
          type: 'success',
        });
      } else if (data.success && data.count === 0) {
        setNotice({
          isOpen: true,
          title: 'No Pages Found',
          message:
            'No Facebook Pages found. Please click "Connect via Facebook Login" to grant access to Monish and Mk memes.',
          type: 'warning',
        });
      } else {
        throw new Error(data.error || 'Failed to sync Facebook pages.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ isOpen: true, title: 'Sync Failed', message: msg, type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectOAuth = async () => {
    try {
      const res = await fetch('/api/facebook/auth');
      const data = await res.json();
      if (data.success && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setNotice({
          isOpen: true,
          title: 'Facebook Login Setup',
          message:
            data.message ||
            'Facebook App credentials are not fully configured. You can also add a Page manually using the "Custom Page" option.',
          type: 'warning',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ isOpen: true, title: 'Connection Failed', message: msg, type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-tab Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20">
              <Facebook className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Facebook Studio &amp; Reels</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Page Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Publish Facebook Reels, high-retention videos, and automated #VAULT lead capture comments.
              </p>
            </div>
          </div>

          {/* Account Selector & Actions */}
          <div className="flex items-center gap-2">
            <div className="relative" ref={accountDropdownRef}>
              <button
                type="button"
                onClick={() => setIsAccountDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all text-xs font-semibold text-slate-800"
              >
                {selectedAccount ? (
                  <>
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold overflow-hidden">
                      {selectedAccount.pictureUrl ? (
                        <img src={selectedAccount.pictureUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        selectedAccount.pageName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="truncate max-w-[130px]">{selectedAccount.pageName}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 font-bold">
                      Live Page
                    </span>
                  </>
                ) : (
                  <span className="text-slate-500">Select Page</span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isAccountDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Connected Pages
                  </div>
                  {accounts.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-500 italic">No Pages connected yet</div>
                  ) : (
                    accounts.map((acc) => (
                      <button
                        key={acc._id}
                        type="button"
                        onClick={() => {
                          setSelectedAccount(acc);
                          setIsAccountDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                          selectedAccount?._id === acc._id ? 'bg-blue-50/60 font-semibold text-blue-700' : 'text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                            {acc.pageName.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate">{acc.pageName}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {(acc.followerCount || 0).toLocaleString()} followers
                        </span>
                      </button>
                    ))
                  )}

                  <div className="border-t border-slate-100 mt-1 pt-1 px-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountDropdownOpen(false);
                        handleConnectOAuth();
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-blue-700 hover:bg-blue-50 font-medium flex items-center gap-2"
                    >
                      <Facebook className="w-3.5 h-3.5" />
                      Connect via Facebook Login
                    </button>
                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={() => {
                        setIsAccountDropdownOpen(false);
                        handleSyncPages();
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-blue-700 hover:bg-blue-50 font-medium flex items-center gap-2"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'Syncing Pages...' : 'Sync Pages from Meta'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountDropdownOpen(false);
                        setIsCustomAccountModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-100 font-medium flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Custom / Sandbox Page
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleConnectOAuth}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Facebook className="w-3.5 h-3.5" />
              Connect Page
            </button>
          </div>
        </div>

        {/* Sub-tab pills */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setSubTab('composer')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              subTab === 'composer'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Reels &amp; Video Composer
          </button>

          <button
            type="button"
            onClick={() => setSubTab('posts')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              subTab === 'posts'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Scheduled &amp; Queue
            {postsCounts.scheduled > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white">
                {postsCounts.scheduled}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('analytics')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              subTab === 'analytics'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Page Analytics
          </button>
        </div>
      </div>

      {/* COMPOSER SUBTAB */}
      {subTab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Composer Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
              {/* Post Type Selector */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPostType('REEL')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                      postType === 'REEL'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Film className="w-4 h-4" />
                    Facebook Reel (9:16)
                  </button>

                  <button
                    type="button"
                    onClick={() => setPostType('VIDEO')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                      postType === 'VIDEO'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Video className="w-4 h-4" />
                    Page Video
                  </button>

                  <button
                    type="button"
                    onClick={() => setPostType('POST')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                      postType === 'POST'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Post / Status
                  </button>
                </div>
              </div>

              {/* Video Media Source Picker */}
              {(postType === 'REEL' || postType === 'VIDEO') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Video Media Source
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        fetchRenderedVideos();
                        setIsVideoPickerOpen(true);
                      }}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1.5 transition-colors"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Pick from Studio Splits
                    </button>
                  </div>

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
                    className="hidden"
                    onChange={handleFileSelected}
                  />

                  {/* Drop card / Action button */}
                  {!selectedVideoTitle && !mediaUrl ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-blue-200 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50/80 rounded-2xl p-6 text-center cursor-pointer transition-all group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-blue-200/80 mx-auto flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                        {isUploadingLocalVideo ? (
                          <RotateCw className="w-6 h-6 animate-spin text-blue-600" />
                        ) : (
                          <Upload className="w-6 h-6" />
                        )}
                      </div>
                      <div className="mt-3">
                        <span className="text-sm font-bold text-slate-800 group-hover:text-blue-700">
                          {isUploadingLocalVideo ? 'Uploading video from PC...' : 'Choose File from PC'}
                        </span>
                        <p className="text-xs text-slate-500 mt-1">
                          Directly upload MP4, MOV, or MKV video from your local computer
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 truncate">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                          <Play className="w-5 h-5 fill-current" />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {selectedVideoTitle || 'Selected Video'}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Ready to publish
                            </span>
                            {selectedVideoSize && (
                              <span className="text-[10px] text-slate-400">
                                &bull; {(selectedVideoSize / (1024 * 1024)).toFixed(1)} MB
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={handleClearSelectedVideo}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Remove video"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Title Input (For Video or Reel) */}
              {(postType === 'REEL' || postType === 'VIDEO') && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                    Reel / Video Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    placeholder="e.g. 5 Mind-Bending Thrillers You Never Knew Existed"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs text-slate-800 placeholder-slate-400 transition-all outline-hidden"
                  />
                </div>
              )}

              {/* Post Description / Caption */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Post Caption &amp; Description
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {message.length} characters
                  </span>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="What is this movie about? Hook the viewer with curiosity gaps, plot twists, and community discussion..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs text-slate-800 placeholder-slate-400 transition-all outline-hidden resize-y font-normal"
                />
              </div>

              {/* Fast Creator Shortcuts */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Fast Creator Shortcuts
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleInsertHook(
                        "I've spent 1000s of hours finding movies that most people never discover. If you love mind-bending thrillers, save this right now."
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors"
                  >
                    + Movie Vault Hook
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleInsertHook(
                        "99% of people missed the ending of this film. Here is the breakdown you weren't supposed to see."
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    + Curiosity Gap Hook
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleInsertHook(
                        "Tag someone who thinks they can predict every movie ending. They won't solve this one."
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    + Tag-Someone Hook
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleInsertHashtags(
                        '#Cinema #MovieRecommendations #FilmYap #Reels #Thrillers #Bollywood'
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    + Hashtags
                  </button>
                </div>
              </div>

              {/* Auto-Comment First Reply (#VAULT CTA) */}
              <div className="bg-blue-50/50 border border-blue-200/60 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Auto-Comment First Reply (Movie Vault CTA)
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={firstCommentEnabled}
                    onChange={(e) => setFirstCommentEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                </div>

                {firstCommentEnabled && (
                  <textarea
                    value={firstCommentText}
                    onChange={(e) => setFirstCommentText(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-blue-200 text-xs text-slate-800 transition-all outline-hidden"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Scheduling & Dispatch */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Clock className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Publish &amp; Scheduling Engine</h3>
              </div>

              {/* Mode switch */}
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPublishMode('schedule')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    publishMode === 'schedule'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Schedule
                </button>
                <button
                  type="button"
                  onClick={() => setPublishMode('now')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    publishMode === 'now'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Publish Now
                </button>
                <button
                  type="button"
                  onClick={() => setPublishMode('draft')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    publishMode === 'draft'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Save Draft
                </button>
              </div>

              {/* Schedule Timing Controls */}
              {publishMode === 'schedule' && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Time
                      </label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Preset daily slots */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">
                      Daily Slot Presets
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyPresetSlot('09:00')}
                        className="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 text-left"
                      >
                        9:00 AM (Indian)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetSlot('14:00')}
                        className="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 text-left"
                      >
                        2:00 PM (Indian)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetSlot('21:00')}
                        className="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 text-left"
                      >
                        9:00 PM (Cinema)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetSlot('23:00')}
                        className="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 text-left"
                      >
                        11:00 PM (Night)
                      </button>
                    </div>
                  </div>

                  {/* Anti-detection randomization */}
                  <label className="flex items-center gap-2 text-xs text-slate-600 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={randomizeMinutes}
                      onChange={(e) => setRandomizeMinutes(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    Randomize time &plusmn;10 mins (anti-detection)
                  </label>
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="button"
                onClick={handleSubmitPost}
                disabled={isSubmitting || isUploadingLocalVideo}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : publishMode === 'now' ? (
                  <>
                    <Send className="w-4 h-4" />
                    Publish Now to {selectedAccount?.pageName || 'Facebook'}
                  </>
                ) : publishMode === 'schedule' ? (
                  <>
                    <Calendar className="w-4 h-4" />
                    Schedule for {selectedAccount?.pageName || 'Facebook'}
                  </>
                ) : (
                  <>
                    <FolderOpen className="w-4 h-4" />
                    Save Draft
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POSTS QUEUE SUBTAB */}
      {subTab === 'posts' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Facebook Posts Queue</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                {postsCounts.all} Total
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 outline-hidden"
              />
              <button
                type="button"
                onClick={fetchPosts}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                title="Refresh queue"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 overflow-x-auto">
            {(['all', 'scheduled', 'published', 'draft', 'failed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {st} ({postsCounts[st] ?? 0})
              </button>
            ))}
          </div>

          {/* Posts List */}
          {isLoadingPosts ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading posts...</div>
          ) : postsList.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 italic">No posts found in this queue.</div>
          ) : (
            <div className="space-y-3">
              {postsList.map((post) => (
                <div
                  key={post._id}
                  className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{post.pageName}</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {post.postType}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          post.status === 'published'
                            ? 'bg-emerald-100 text-emerald-700'
                            : post.status === 'scheduled'
                            ? 'bg-amber-100 text-amber-700'
                            : post.status === 'failed'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {post.status}
                      </span>
                    </div>
                    {post.title && <div className="text-xs font-semibold text-slate-900">{post.title}</div>}
                    <p className="text-xs text-slate-600 line-clamp-2">{post.message}</p>
                    <div className="flex items-center gap-4 text-[11px] text-slate-400">
                      {post.scheduleAt && (
                        <span>Scheduled: {new Date(post.scheduleAt).toLocaleString()}</span>
                      )}
                      {post.publishedAt && (
                        <span>Published: {new Date(post.publishedAt).toLocaleString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {post.facebookPermalink && (
                      <a
                        href={post.facebookPermalink}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View Live
                      </a>
                    )}
                    {post.status !== 'published' && (
                      <button
                        type="button"
                        onClick={() => handlePublishNow(post)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                      >
                        Publish Now
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setRescheduleTarget(post);
                        setRescheduleDate(post.scheduleAt?.split('T')[0] || '');
                      }}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                      title="Reschedule"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePost(post._id)}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ANALYTICS SUBTAB */}
      {subTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Views</div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {(analyticsData?.totalViews || 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Live &amp; Mocked</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Reach</div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {(analyticsData?.totalReach || 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-blue-600 font-semibold mt-1 block">Audience Footprint</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Reactions</div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {(analyticsData?.totalLikes || 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-indigo-600 font-semibold mt-1 block">Likes &amp; Reactions</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Engagement Rate</div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {analyticsData?.avgEngagement || 0}%
              </div>
              <span className="text-[11px] text-purple-600 font-semibold mt-1 block">Average per Reel</span>
            </div>
          </div>
        </div>
      )}

      {/* Video Picker Modal */}
      {isVideoPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Choose from Studio Splits</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsVideoPickerOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {isLoadingVideos ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading rendered clips...</div>
              ) : renderedVideos.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 italic">
                  No completed splits found in Studio. You can render video parts or choose a file directly from your PC.
                </div>
              ) : (
                renderedVideos.map((v, i) => (
                  <div
                    key={i}
                    onClick={() => handleSelectVideo(v)}
                    className="p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer flex items-center justify-between transition-all"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800">{v.originalTitle}</div>
                      <div className="text-[11px] text-slate-500">
                        Part {v.partIndex} of {v.totalParts} &bull; {v.filename}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                    >
                      Select
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm">Reschedule Post</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Time</label>
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveReschedule}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom / Sandbox Page Modal */}
      {isCustomAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Facebook className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Add Facebook Page (Sandbox / Manual)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomAccountModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Page Name *</label>
                <input
                  type="text"
                  placeholder="e.g. FlimYap Official"
                  value={customPageName}
                  onChange={(e) => setCustomPageName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Page ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 1029384756"
                  value={customPageId}
                  onChange={(e) => setCustomPageId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Category</label>
                <input
                  type="text"
                  placeholder="Cinema & Entertainment"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Page Access Token (Leave empty for simulated offline testing)
                </label>
                <textarea
                  placeholder="EAAB..."
                  rows={2}
                  value={customToken}
                  onChange={(e) => setCustomToken(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-hidden font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCustomAccountModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomAccount}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              >
                Add Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* System Notice Modal */}
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
