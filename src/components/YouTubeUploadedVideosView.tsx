'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Eye,
  ThumbsUp,
  MessageSquare,
  ExternalLink,
  RotateCw,
  Search,
  Film,
  Calendar,
  Smartphone,
  Tv,
  Youtube,
  Folder,
  TrendingUp,
  BarChart2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { CustomSelect } from './ui/CustomSelect';
import { NoticeModal } from './ui/NoticeModal';

export interface UploadedVideoItem {
  _id: string;
  channelId: string;
  channelTitle: string;
  folderName: string;
  title: string;
  description?: string;
  tags?: string[];
  privacyStatus: 'public' | 'unlisted' | 'private';
  videoType: 'short' | 'long_form';
  status: 'uploading' | 'completed' | 'failed';
  videoId?: string;
  youtubeUrl?: string;
  publishedAt?: string;
  views?: number;
  likes?: number;
  comments?: number;
  lastCheckedAt?: string;
  createdAt: string;
}

interface StatsSummary {
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
}

interface TrendBucket {
  key: string;
  label: string;
  subLabel?: string;
  views: number;
  likes: number;
  comments: number;
  videoCount: number;
}

interface TrendsData {
  timeframe: 'daily' | 'weekly' | 'monthly';
  buckets: TrendBucket[];
  summary: {
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalVideos: number;
    avgViews: number;
    peakBucketLabel: string;
    peakBucketViews: number;
  };
  topVideos: Array<{
    _id: string;
    videoId?: string;
    title: string;
    channelTitle: string;
    views: number;
    likes: number;
    comments: number;
    youtubeUrl?: string;
    publishedAt?: string;
  }>;
}

// Smooth cubic Bézier curve calculation
function getCurvedPath(pts: Array<{ x: number; y: number }>) {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let path = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    path += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return path;
}

export function YouTubeUploadedVideosView() {
  const [videos, setVideos] = useState<UploadedVideoItem[]>([]);
  const [stats, setStats] = useState<StatsSummary>({
    totalVideos: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Timeframe state: daily | weekly | monthly
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedMetric, setSelectedMetric] = useState<'views' | 'likes' | 'comments'>('views');
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [channels, setChannels] = useState<Array<{ channelId: string; channelTitle: string }>>([]);

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

  // Fetch Trends Data (Daily / Weekly / Monthly views)
  const fetchTrends = useCallback(async () => {
    try {
      setIsLoadingTrends(true);
      const params = new URLSearchParams({
        timeframe,
        channelId: channelFilter,
      });
      const res = await fetch(`/api/youtube/analytics/trends?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTrends(data);
      }
    } catch {
      // Non-fatal
    } finally {
      setIsLoadingTrends(false);
    }
  }, [timeframe, channelFilter]);

  // Fetch Video List
  const fetchVideos = useCallback(
    async (sync = false) => {
      try {
        if (sync) setIsSyncing(true);
        else setIsLoading(true);

        const params = new URLSearchParams();
        if (channelFilter !== 'all') params.set('channelId', channelFilter);
        if (typeFilter !== 'all') params.set('videoType', typeFilter);
        if (searchTerm.trim()) params.set('search', searchTerm.trim());
        if (sync) params.set('sync', 'true');

        const res = await fetch(`/api/youtube/history?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setVideos(data.history || []);
          if (data.stats) {
            setStats(data.stats);
          }

          const channelMap = new Map<string, string>();
          (data.history || []).forEach((v: UploadedVideoItem) => {
            if (v.channelId && v.channelTitle) {
              channelMap.set(v.channelId, v.channelTitle);
            }
          });
          setChannels(
            Array.from(channelMap.entries()).map(([channelId, channelTitle]) => ({
              channelId,
              channelTitle,
            }))
          );

          if (sync) {
            fetchTrends();
            setNotice({
              isOpen: true,
              title: 'Views Synchronized',
              message: 'Successfully refreshed live statistics from YouTube!',
              type: 'success',
            });
          }
        }
      } catch {
        if (sync) {
          setNotice({
            isOpen: true,
            title: 'Sync Failed',
            message: 'Unable to refresh views from YouTube at this moment.',
            type: 'error',
          });
        }
      } finally {
        setIsLoading(false);
        setIsSyncing(false);
      }
    },
    [channelFilter, typeFilter, searchTerm, fetchTrends]
  );

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  const filteredVideos = useMemo(() => {
    if (!searchTerm.trim()) return videos;
    const term = searchTerm.toLowerCase();
    return videos.filter(
      (v) =>
        v.title.toLowerCase().includes(term) ||
        v.channelTitle.toLowerCase().includes(term) ||
        v.folderName.toLowerCase().includes(term)
    );
  }, [videos, searchTerm]);

  const formatNumber = (num: number = 0) => num.toLocaleString();

  // Metric visual configuration (Plausible / Linear minimalist style)
  const metricStyles = {
    views: {
      label: 'Views',
      color: '#E11D48',
      stroke: '#E11D48',
      gradId: 'minimalViewsGrad',
    },
    likes: {
      label: 'Likes',
      color: '#059669',
      stroke: '#059669',
      gradId: 'minimalLikesGrad',
    },
    comments: {
      label: 'Comments',
      color: '#D97706',
      stroke: '#D97706',
      gradId: 'minimalCommentsGrad',
    },
  };

  const getMetricVal = useCallback(
    (b: TrendBucket) => {
      if (selectedMetric === 'likes') return b.likes;
      if (selectedMetric === 'comments') return b.comments;
      return b.views;
    },
    [selectedMetric]
  );

  // SVG Chart Dimensions
  const chartBuckets = trends?.buckets || [];
  const maxValInBuckets = Math.max(...chartBuckets.map(getMetricVal), 10);
  const chartWidth = 800;
  const chartHeight = 220;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const points = chartBuckets.map((b, i) => {
    const val = getMetricVal(b);
    const x = paddingLeft + (chartBuckets.length > 1 ? (i / (chartBuckets.length - 1)) * plotWidth : plotWidth / 2);
    const y = paddingTop + plotHeight - (val / maxValInBuckets) * plotHeight;
    return { x, y, bucket: b, value: val, index: i };
  });

  const linePath = getCurvedPath(points);
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + plotHeight} L ${points[0].x} ${paddingTop + plotHeight} Z`
    : '';

  const activeHover = hoveredIndex !== null ? points[hoveredIndex] : null;
  const activeStyle = metricStyles[selectedMetric];

  // Primary metric total
  const primaryTotal = selectedMetric === 'likes'
    ? stats.totalLikes
    : selectedMetric === 'comments'
    ? stats.totalComments
    : stats.totalViews;

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-16 animate-fadeIn">
      {/* 1. Simple, Clean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Uploaded Videos</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {stats.totalVideos} videos
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Live views and performance across your YouTube channels
          </p>
        </div>

        <button
          onClick={() => fetchVideos(true)}
          disabled={isSyncing}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-sm transition-all disabled:opacity-50 self-start sm:self-auto"
        >
          <RotateCw className={`w-3.5 h-3.5 text-rose-600 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing...' : 'Refresh Views'}</span>
        </button>
      </div>

      {/* 2. Plausible-Style Unified Hero Analytics Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-5">
        {/* Top Control Bar: Total Stat + Segmented Switchers */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {formatNumber(primaryTotal)}
              </span>
              <span className="text-sm font-semibold text-slate-500">
                {activeStyle.label.toLowerCase()}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              <span>{formatNumber(stats.totalViews)} views</span>
              <span>&bull;</span>
              <span>{formatNumber(stats.totalLikes)} likes</span>
              <span>&bull;</span>
              <span>{formatNumber(stats.totalComments)} comments</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Metric Mode Filter (Views / Likes / Comments) */}
            <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200 text-xs">
              {(['views', 'likes', 'comments'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedMetric(m)}
                  className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition-all ${
                    selectedMetric === m
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Timeframe Segmented Control (Daily / Weekly / Monthly) */}
            <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setTimeframe('daily')}
                className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
                  timeframe === 'daily'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daily (14d)
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('weekly')}
                className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
                  timeframe === 'weekly'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Weekly (8w)
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('monthly')}
                className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
                  timeframe === 'monthly'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly (6m)
              </button>
            </div>
          </div>
        </div>

        {/* Hover Status Tag */}
        <div className="h-5 flex items-center justify-between text-xs">
          {activeHover ? (
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-700 animate-fadeIn">
              <span className="font-bold text-rose-600">{activeHover.bucket.label}:</span>
              <span className="font-bold">{formatNumber(activeHover.value)} {selectedMetric}</span>
              <span className="text-slate-400">
                ({activeHover.bucket.likes} likes, {activeHover.bucket.comments} comments)
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">
              Hover over the graph to inspect daily or weekly counts
            </span>
          )}

          {trends && trends.summary.peakBucketViews > 0 && (
            <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
              Peak: <span className="font-bold text-slate-800">{trends.summary.peakBucketLabel}</span> ({formatNumber(trends.summary.peakBucketViews)} views)
            </span>
          )}
        </div>

        {/* Full-Width Responsive Minimalist Chart */}
        <div className="relative w-full overflow-hidden">
          {isLoadingTrends ? (
            <div className="h-56 flex items-center justify-center text-slate-400 text-xs gap-2">
              <RotateCw className="w-4 h-4 animate-spin text-rose-500" />
              <span>Loading analytics...</span>
            </div>
          ) : chartBuckets.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-slate-400 text-xs">
              No trend data recorded for this timeframe yet.
            </div>
          ) : (
            <div className="w-full">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-56 overflow-visible"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="minimalViewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E11D48" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#E11D48" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="minimalLikesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="minimalCommentsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D97706" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#D97706" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Y-axis Labels on Left */}
                <g className="text-[10px] font-mono fill-slate-400 select-none">
                  <text x={paddingLeft - 8} y={paddingTop + 4} textAnchor="end">
                    {formatNumber(maxValInBuckets)}
                  </text>
                  <text x={paddingLeft - 8} y={paddingTop + plotHeight / 2 + 3} textAnchor="end">
                    {formatNumber(Math.round(maxValInBuckets / 2))}
                  </text>
                  <text x={paddingLeft - 8} y={paddingTop + plotHeight} textAnchor="end">
                    0
                  </text>
                </g>

                {/* Clean Guidelines */}
                <line
                  x1={paddingLeft}
                  y1={paddingTop}
                  x2={paddingLeft + plotWidth}
                  y2={paddingTop}
                  stroke="#F1F5F9"
                  strokeDasharray="4 4"
                />
                <line
                  x1={paddingLeft}
                  y1={paddingTop + plotHeight / 2}
                  x2={paddingLeft + plotWidth}
                  y2={paddingTop + plotHeight / 2}
                  stroke="#F1F5F9"
                  strokeDasharray="4 4"
                />
                <line
                  x1={paddingLeft}
                  y1={paddingTop + plotHeight}
                  x2={paddingLeft + plotWidth}
                  y2={paddingTop + plotHeight}
                  stroke="#E2E8F0"
                />

                {/* Vertical Tracker Guide on Hover */}
                {activeHover && (
                  <line
                    x1={activeHover.x}
                    y1={paddingTop}
                    x2={activeHover.x}
                    y2={paddingTop + plotHeight}
                    stroke={activeStyle.color}
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.75"
                  />
                )}

                {/* Area Gradient Fill */}
                {areaPath && (
                  <path
                    d={areaPath}
                    fill={`url(#${activeStyle.gradId})`}
                    className="transition-all duration-300"
                  />
                )}

                {/* Smooth Bézier Curve Line */}
                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke={activeStyle.stroke}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-300"
                  />
                )}

                {/* Interactive Points */}
                {points.map((p) => {
                  const isHovered = hoveredIndex === p.index;
                  return (
                    <g key={p.index} className="cursor-pointer">
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHovered ? 5.5 : 3}
                        fill="#FFFFFF"
                        stroke={activeStyle.color}
                        strokeWidth={isHovered ? 2.5 : 1.5}
                        onMouseEnter={() => setHoveredIndex(p.index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        className="transition-all duration-150"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* X-axis Labels */}
              <div className="flex justify-between items-center px-10 pt-1 text-[10px] text-slate-400 font-mono">
                {chartBuckets
                  .filter((_, idx) => idx % (timeframe === 'daily' ? 2 : 1) === 0)
                  .map((b) => (
                    <span key={b.key} className="truncate">
                      {b.label}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Published Videos List & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Simple Filter Strip */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search videos..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <div className="w-40">
              <CustomSelect
                value={channelFilter}
                onChange={(val) => setChannelFilter(val)}
                size="sm"
                options={[
                  { value: 'all', label: 'All Channels' },
                  ...channels.map((c) => ({
                    value: c.channelId,
                    label: c.channelTitle,
                  })),
                ]}
              />
            </div>

            <div className="w-32">
              <CustomSelect
                value={typeFilter}
                onChange={(val) => setTypeFilter(val)}
                size="sm"
                options={[
                  { value: 'all', label: 'All Formats' },
                  { value: 'short', label: 'Shorts' },
                  { value: 'long_form', label: 'Long-Form' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Video Table */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 space-y-2">
            <RotateCw className="w-5 h-5 animate-spin mx-auto text-rose-500" />
            <p className="text-xs">Loading videos...</p>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Film className="w-8 h-8 mx-auto text-slate-300" />
            <div className="text-sm font-semibold text-slate-700">No Videos Found</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No videos have been uploaded yet or match your current search query.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5">Video</th>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Views</th>
                  <th className="py-3 px-4">Likes</th>
                  <th className="py-3 px-4">Comments</th>
                  <th className="py-3 px-4">Format</th>
                  <th className="py-3 px-4">Published</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredVideos.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Video Title & Folder */}
                    <td className="py-3 px-5">
                      <div className="space-y-0.5 max-w-sm">
                        <div className="font-semibold text-slate-900 line-clamp-1">
                          {item.title}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                          <Folder className="w-2.5 h-2.5 text-slate-400" />
                          <span>{item.folderName}</span>
                          {item.privacyStatus && (
                            <span className="capitalize text-slate-400">
                              &bull; {item.privacyStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Channel */}
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Youtube className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        <span className="truncate max-w-[140px]">{item.channelTitle}</span>
                      </div>
                    </td>

                    {/* Views */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold text-xs">
                        <Eye className="w-3 h-3 text-rose-600" />
                        <span>{formatNumber(item.views || 0)}</span>
                      </div>
                    </td>

                    {/* Likes */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-semibold">
                      <div className="flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3 text-slate-400" />
                        <span>{formatNumber(item.likes || 0)}</span>
                      </div>
                    </td>

                    {/* Comments */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-semibold">
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-slate-400" />
                        <span>{formatNumber(item.comments || 0)}</span>
                      </div>
                    </td>

                    {/* Format */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          item.videoType === 'short'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {item.videoType === 'short' ? (
                          <>
                            <Smartphone className="w-3 h-3" /> Shorts
                          </>
                        ) : (
                          <>
                            <Tv className="w-3 h-3" /> Long-Form
                          </>
                        )}
                      </span>
                    </td>

                    {/* Published Date */}
                    <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                      {item.publishedAt
                        ? new Date(item.publishedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'N/A'}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      {item.youtubeUrl ? (
                        <a
                          href={item.youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                        >
                          <span>Watch</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Global Notice Modal */}
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
