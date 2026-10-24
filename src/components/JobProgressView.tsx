'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  RotateCw,
  Download,
  Film,
  Terminal,
  ExternalLink,
  Ban,
  Copy,
  Check
} from 'lucide-react';
import { IJob, IPart } from '@/shared/types';

interface JobProgressViewProps {
  jobId: string;
  onJobFinished?: () => void;
}

export function JobProgressView({ jobId, onJobFinished }: JobProgressViewProps) {
  const [job, setJob] = useState<IJob | null>(null);
  const [parts, setParts] = useState<IPart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'render'>('all');
  const [jobLogs, setJobLogs] = useState<any[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const copyToClipboard = async (url: string, index: number) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const el = document.createElement('textarea');
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopiedIndex(index);
      setTimeout(() => {
        setCopiedIndex((prev) => (prev === index ? null : prev));
      }, 2000);
    } catch {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const copyAllLinks = async () => {
    const uploadedParts = parts.filter(
      (p) => p.driveLink || p.driveFileId
    );
    if (uploadedParts.length === 0) return;
    const text = uploadedParts
      .map(
        (p) =>
          `Part ${p.index} (${p.filename}): ${
            p.driveLink || `https://drive.google.com/file/d/${p.driveFileId}/view`
          }`
      )
      .join('\n');
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  const fetchJobData = async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setJob(data.job);
        setParts(data.parts || []);

        if (['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(data.job.status)) {
          onJobFinished?.();
        }
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/logs`);
      if (res.ok) {
        const data = await res.json();
        setJobLogs(data.logs || []);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchJobData();
    fetchLogs();
    const interval = setInterval(() => {
      fetchJobData();
      fetchLogs();
    }, 2000);
    return () => clearInterval(interval);
  }, [jobId]);

  const cancelJob = async () => {
    if (!confirm('Are you sure you want to cancel this render job?')) return;
    try {
      setActionLoading(true);
      await fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
      await fetchJobData();
    } catch {
      // Ignore
    } finally {
      setActionLoading(false);
    }
  };

  const retryFailed = async () => {
    try {
      setActionLoading(true);
      await fetch(`/api/jobs/${jobId}/retry-failed`, { method: 'POST' });
      await fetchJobData();
    } catch {
      // Ignore
    } finally {
      setActionLoading(false);
    }
  };

  const retrySinglePart = async (index: number) => {
    try {
      setActionLoading(true);
      await fetch(`/api/jobs/${jobId}/parts/${index}/retry`, { method: 'POST' });
      await fetchJobData();
    } catch {
      // Ignore
    } finally {
      setActionLoading(false);
    }
  };

  // Overall progress calculation
  const totalCount = parts.length || 1;
  const totalRenderProgress = parts.reduce((acc, p) => acc + (p.renderProgress || 0), 0);
  const overallPercent = Math.min(100, Math.round(totalRenderProgress / totalCount));

  if (isLoading && !job) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center flex flex-col items-center justify-center border border-[#90CAF9]/60 shadow-sm">
        <RotateCw className="w-8 h-8 animate-spin text-[#2196F3] mb-2" />
        <p className="text-xs text-slate-600 font-medium">Loading render job {jobId}...</p>
      </div>
    );
  }

  const isTerminal = ['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(job?.status || '');

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Overall Summary */}
      <div className="bg-white rounded-2xl p-6 border border-[#90CAF9]/60 shadow-sm flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#90CAF9]/40">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                  job?.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : job?.status === 'completed_with_errors'
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : job?.status === 'failed' || job?.status === 'cancelled'
                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                    : 'bg-[#E3F2FD] text-[#0D47A1] border-[#90CAF9] animate-pulse'
                }`}
              >
                {job?.status}
              </span>
              <span className="text-xs font-mono text-slate-500 font-semibold">ID: {jobId}</span>
            </div>
            <h3 className="text-base font-bold text-[#0D47A1] flex items-center gap-2">
              {job?.source.originalName}
            </h3>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {!isTerminal && (
              <button
                disabled={actionLoading}
                onClick={cancelJob}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-semibold transition-all disabled:opacity-40"
              >
                <Ban className="w-3.5 h-3.5" />
                Cancel Job
              </button>
            )}

            {(job?.counts.failed ?? 0) > 0 && (
              <button
                disabled={actionLoading}
                onClick={retryFailed}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold transition-all"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Retry Failed Parts ({job?.counts.failed})
              </button>
            )}

            {parts.some((p) => p.driveLink || p.driveFileId) && (
              <button
                type="button"
                onClick={copyAllLinks}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold transition-all shadow-sm"
                title="Copy all Google Drive URLs"
              >
                {copiedAll ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>All Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copy All Links</span>
                  </>
                )}
              </button>
            )}

            <a
              href={`/logs/jobs/${jobId}.log`}
              download
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#E3F2FD] hover:bg-[#90CAF9]/40 text-[#0D47A1] border border-[#90CAF9] text-xs font-semibold transition-all shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-[#2196F3]" />
              Download Logs
            </a>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-600 font-semibold">Batch Rendering Progress</span>
            <span className="text-[#2196F3] font-bold font-mono text-sm">{overallPercent}%</span>
          </div>
          <div className="w-full bg-[#E3F2FD] h-3.5 rounded-full overflow-hidden border border-[#90CAF9]">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                job?.status === 'completed'
                  ? 'bg-emerald-500'
                  : job?.status === 'completed_with_errors'
                  ? 'bg-amber-500'
                  : 'bg-[#2196F3]'
              }`}
              style={{ width: `${overallPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-500 font-mono font-semibold">
            <span>
              {job?.counts.uploaded ? `${job.counts.uploaded} uploaded to Drive • ` : ''}
              {job?.counts.rendered ?? 0} of {totalCount} parts completed
            </span>
            <span>
              {(job?.counts.failed ?? 0) > 0 ? `${job?.counts.failed} failed` : '0 errors'}
            </span>
          </div>
        </div>
      </div>

      {/* Parts Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {parts.map((part) => {
          const uploadUrl =
            part.driveLink ||
            (part.driveFileId ? `https://drive.google.com/file/d/${part.driveFileId}/view` : null);
          const isUploaded = part.status === 'uploaded' || !!uploadUrl;
          const isUploading = part.status === 'uploading';
          const isRendered = part.status === 'rendered';

          return (
            <div
              key={part.index}
              className="bg-white rounded-xl p-4 flex flex-col gap-3 border border-[#90CAF9]/60 shadow-sm hover:border-[#2196F3] transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono ${
                      isUploaded || isRendered
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                        : part.status === 'failed'
                        ? 'bg-rose-50 text-rose-700 border border-rose-300'
                        : part.status === 'rendering' || isUploading
                        ? 'bg-[#E3F2FD] text-[#2196F3] border border-[#90CAF9] animate-pulse'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {part.index}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#0D47A1] truncate max-w-[200px]" title={part.filename}>
                      {part.filename}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-mono font-medium">
                      {part.start}s &rarr; {part.end}s ({part.duration}s)
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                    isUploaded || isRendered
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : part.status === 'failed'
                      ? 'bg-rose-50 text-rose-700 border-rose-300'
                      : part.status === 'rendering' || isUploading
                      ? 'bg-[#E3F2FD] text-[#2196F3] border-[#90CAF9]'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}
                >
                  {isUploaded ? 'UPLOADED' : part.status}
                </span>
              </div>

              {/* Individual Progress Bar */}
              <div className="w-full bg-[#E3F2FD] h-2 rounded-full overflow-hidden border border-[#90CAF9]/40">
                <div
                  className={`h-full transition-all duration-200 ${
                    isUploaded || isRendered
                      ? 'bg-emerald-500'
                      : part.status === 'failed'
                      ? 'bg-rose-500'
                      : 'bg-[#2196F3]'
                  }`}
                  style={{
                    width: `${
                      isUploaded || isRendered
                        ? 100
                        : isUploading
                        ? part.uploadProgress || 50
                        : part.renderProgress
                    }%`,
                  }}
                />
              </div>

              {/* Error Details */}
              {part.status === 'failed' && (
                <div className="flex items-center justify-between text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                  <span className="truncate max-w-[200px] font-medium">{part.lastError || 'Render error'}</span>
                  <button
                    onClick={() => retrySinglePart(part.index)}
                    className="font-bold underline text-rose-800 hover:text-rose-950 shrink-0 ml-2"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Google Drive Upload URL Section on the Video Card */}
              {uploadUrl ? (
                <div className="flex flex-col gap-2 pt-2.5 border-t border-[#90CAF9]/40 mt-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Drive Uploaded</span>
                      {part.outputSize ? (
                        <span className="text-slate-500 font-mono text-[10px]">
                          &bull; {(part.outputSize / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(uploadUrl, part.index)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E3F2FD] hover:bg-[#90CAF9]/50 text-[#0D47A1] text-[11px] font-semibold border border-[#90CAF9] transition-all cursor-pointer"
                        title="Copy Google Drive URL"
                      >
                        {copiedIndex === part.index ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700 font-bold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-[#2196F3]" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>

                      <a
                        href={uploadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2196F3] hover:bg-[#1E88E5] text-white text-[11px] font-semibold transition-all shadow-sm shadow-[#2196F3]/20"
                        title="Open in Google Drive"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open</span>
                      </a>
                    </div>
                  </div>

                  {/* Direct clickable URL display */}
                  <div className="flex items-center gap-2 bg-[#F0F7FF] border border-[#90CAF9]/80 rounded-lg px-2.5 py-1.5 overflow-hidden">
                    <ExternalLink className="w-3.5 h-3.5 text-[#2196F3] shrink-0" />
                    <a
                      href={uploadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono text-[#0D47A1] truncate flex-1 underline underline-offset-2 hover:text-[#1E88E5] font-medium"
                      title={uploadUrl}
                    >
                      {uploadUrl}
                    </a>
                  </div>
                </div>
              ) : isUploading ? (
                <div className="flex items-center justify-between text-[11px] text-[#0D47A1] bg-[#E3F2FD]/50 p-2 rounded-lg border border-[#90CAF9]/60">
                  <div className="flex items-center gap-1.5 font-medium">
                    <RotateCw className="w-3 h-3 animate-spin text-[#2196F3]" />
                    <span>Uploading to Google Drive...</span>
                  </div>
                  <span className="font-mono font-bold text-[#2196F3] text-[10px]">{part.uploadProgress || 0}%</span>
                </div>
              ) : isRendered ? (
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono font-medium">
                  <span>{(part.outputSize ? part.outputSize / (1024 * 1024) : 0).toFixed(1)} MB</span>
                  <span className="text-emerald-700 font-bold">Verified &bull; H.264/AAC</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Live Log Panel */}
      <div className="bg-white rounded-2xl p-5 border border-[#90CAF9]/60 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-[#90CAF9]/40 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#2196F3]" />
            <h4 className="text-xs font-bold text-[#0D47A1] uppercase tracking-wider">
              Section 8 Live Job Stream (logs/jobs/{jobId}.log)
            </h4>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setLogFilter('all')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                logFilter === 'all'
                  ? 'bg-[#2196F3] text-white shadow-sm'
                  : 'bg-[#E3F2FD] text-[#0D47A1] hover:bg-[#90CAF9]/40'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setLogFilter('render')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                logFilter === 'render'
                  ? 'bg-[#2196F3] text-white shadow-sm'
                  : 'bg-[#E3F2FD] text-[#0D47A1] hover:bg-[#90CAF9]/40'
              }`}
            >
              Render
            </button>
            <button
              onClick={() => setLogFilter('error')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                logFilter === 'error'
                  ? 'bg-[#2196F3] text-white shadow-sm'
                  : 'bg-[#E3F2FD] text-[#0D47A1] hover:bg-[#90CAF9]/40'
              }`}
            >
              Errors
            </button>
          </div>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 font-mono text-[11px] max-h-56 overflow-y-auto divide-y divide-slate-800/80 shadow-inner">
          {jobLogs
            .filter((l) => (logFilter === 'all' ? true : l.channel === logFilter || l.level === logFilter))
            .map((l, i) => (
              <div key={i} className="py-1 flex items-start gap-2">
                <span className="text-slate-400 shrink-0 text-[10px]">
                  {l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : ''}
                </span>
                <span
                  className={`uppercase text-[9px] font-bold px-1 rounded shrink-0 ${
                    l.level === 'error'
                      ? 'bg-rose-500/20 text-rose-400'
                      : l.level === 'warn'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-sky-500/20 text-sky-400'
                  }`}
                >
                  {l.level}
                </span>
                <span className="text-[#90CAF9] shrink-0 font-semibold">[{l.channel}]</span>
                <span className="text-slate-200 break-all">{l.message}</span>
              </div>
            ))}
          {jobLogs.length === 0 && (
            <p className="text-slate-400 italic py-4 text-center">
              Listening for worker stream logs...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
