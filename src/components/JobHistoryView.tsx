'use client';

import React, { useState, useEffect } from 'react';
import {
  History,
  RotateCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Trash2,
  Copy,
  ExternalLink,
  Download,
  Film,
  Play,
  Folder as FolderIcon
} from 'lucide-react';
import { IJob, IFolder } from '@/shared/types';
import { CustomSelect } from './ui/CustomSelect';
import { NoticeModal } from './ui/NoticeModal';

interface JobHistoryViewProps {
  onSelectJob: (jobId: string) => void;
  onDuplicateJob: (job: IJob) => void;
}

export function JobHistoryView({ onSelectJob, onDuplicateJob }: JobHistoryViewProps) {
  const [jobs, setJobs] = useState<IJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [folders, setFolders] = useState<IFolder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);

  const fetchFolders = async () => {
    try {
      const res = await fetch('/api/folders');
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
      }
    } catch {}
  };

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      const query = new URLSearchParams({
        page: String(page),
        limit: '10',
        status: statusFilter,
        folder: folderFilter,
      });
      const res = await fetch(`/api/jobs?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
        setTotalPages(data.totalPages || 1);
        setTotalJobs(data.total || 0);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [page, statusFilter, folderFilter]);

  // Modal notice state
  const [notice, setNotice] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    message: '',
  });

  const handleDelete = async (jobId: string) => {
    setNotice({
      isOpen: true,
      title: 'Delete Job',
      message: 'Are you sure you want to delete this job and its working files?',
      type: 'warning',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
          if (res.ok) {
            fetchJobs();
          }
        } catch {
          setNotice({
            isOpen: true,
            title: 'Error',
            message: 'Failed to delete job',
            type: 'error',
          });
        }
      },
    });
  };

  const filteredJobs = jobs.filter((j) =>
    (j.source?.originalName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Completed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#E3F2FD] text-[#0D47A1] border border-[#90CAF9]">
            <RotateCw className="w-3 h-3 animate-spin text-[#2196F3]" />
            Processing
          </span>
        );
      case 'completed_with_errors':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            Partial Failures
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#E3F2FD] text-[#0D47A1] border border-[#90CAF9]">
            <Clock className="w-3 h-3 text-[#2196F3]" />
            Queued
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-[#90CAF9] shadow-sm flex flex-col gap-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#90CAF9]/40">
        <div>
          <h2 className="text-lg font-bold text-[#0D47A1] flex items-center gap-2">
            <History className="w-5 h-5 text-[#2196F3]" />
            Render Job History
          </h2>
          <p className="text-xs text-slate-500">
            Catalog of all past video split and reframe tasks ({totalJobs} total jobs)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#2196F3] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search filename..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#E3F2FD]/40 border border-[#90CAF9] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#0D47A1] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2196F3] w-44 sm:w-56"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 bg-[#E3F2FD]/50 p-1 rounded-xl border border-[#90CAF9] text-xs">
            <Filter className="w-3 h-3 text-[#2196F3] ml-2 mr-1" />
            {['all', 'completed', 'processing', 'failed'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize transition-all ${
                  statusFilter === st
                    ? 'bg-[#2196F3] text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-[#0D47A1]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Folder Filter Dropdown */}
          <div className="w-52">
            <CustomSelect
              value={folderFilter}
              onChange={(val) => {
                setFolderFilter(val);
                setPage(1);
              }}
              size="sm"
              options={[
                {
                  value: 'all',
                  label: 'All Folders',
                  badge: `${folders.reduce((acc, f) => acc + (f.jobCount || 0), 0)}`,
                },
                ...folders.map((f) => ({
                  value: f.name,
                  label: f.name,
                  badge: `${f.jobCount || 0}`,
                })),
              ]}
            />
          </div>

          <button
            onClick={fetchJobs}
            title="Refresh jobs"
            className="p-2 rounded-xl bg-[#E3F2FD]/40 hover:bg-[#E3F2FD] text-[#0D47A1] transition-all border border-[#90CAF9]"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="overflow-x-auto rounded-xl border border-[#90CAF9]/60">
        <table className="w-full text-left text-xs text-slate-700 border-collapse">
          <thead>
            <tr className="border-b border-[#90CAF9]/60 text-[11px] uppercase tracking-wider text-[#0D47A1] font-bold bg-[#E3F2FD]/50">
              <th className="py-3 px-4">Source Video</th>
              <th className="py-3 px-3">Date</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Format / Ratio</th>
              <th className="py-3 px-3">Parts</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredJobs.map((job) => {
              const jobId = String((job as any)._id);
              const createdAt = new Date(job.createdAt).toLocaleString();
              const hasRenderedParts = (job.counts?.rendered || 0) > 0;
              const assignedFolder = job.folderName || 'General';

              return (
                <tr key={jobId} className="hover:bg-[#E3F2FD]/25 transition-colors group">
                  <td className="py-3.5 px-4 font-medium text-slate-900 flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-[#E3F2FD] text-[#2196F3] shrink-0 border border-[#90CAF9]/60">
                      <Film className="w-4 h-4" />
                    </div>
                    <div className="truncate max-w-[220px]">
                      <p className="truncate font-semibold text-[#0D47A1]">
                        {job.source?.originalName || 'Untitled Job'}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-0.5">
                        <span className="px-1.5 py-0.5 rounded-md bg-[#E3F2FD] text-[#0D47A1] font-bold border border-[#90CAF9]/40 flex items-center gap-1">
                          <FolderIcon className="w-2.5 h-2.5 text-[#2196F3]" />
                          {assignedFolder}
                        </span>
                        <span>&bull;</span>
                        <span>{((job.source?.sizeBytes || 0) / (1024 * 1024)).toFixed(1)} MB</span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                    {createdAt}
                  </td>

                  <td className="py-3.5 px-3 whitespace-nowrap">
                    {getStatusBadge(job.status)}
                  </td>

                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <span className="font-mono text-[#0D47A1] font-bold bg-[#E3F2FD] px-2 py-0.5 rounded border border-[#90CAF9]">
                      {job.settings?.outputFormat?.aspectRatio || '9:16'}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-1.5 capitalize font-medium">
                      {job.settings?.outputFormat?.reframeMode || 'blur'}
                    </span>
                  </td>

                  <td className="py-3.5 px-3 whitespace-nowrap font-mono text-[11px]">
                    <span className="text-emerald-600 font-bold">{job.counts?.rendered || 0}</span>
                    <span className="text-slate-400"> / </span>
                    <span className="text-slate-700 font-semibold">{job.counts?.total || 0}</span>
                    {job.counts?.failed ? (
                      <span className="text-rose-600 ml-1.5 font-bold">({job.counts.failed} failed)</span>
                    ) : null}
                  </td>

                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Open Job in Queue view */}
                      <button
                        onClick={() => onSelectJob(jobId)}
                        title="View Live Queue / Parts"
                        className="p-1.5 rounded-lg bg-[#E3F2FD] hover:bg-[#2196F3] text-[#0D47A1] hover:text-white border border-[#90CAF9] transition-all"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>

                      {/* Download ZIP */}
                      {hasRenderedParts && (
                        <a
                          href={`/api/jobs/${jobId}/download-zip`}
                          download
                          title="Download Parts ZIP"
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 transition-all inline-block"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}

                      {/* Duplicate Settings */}
                      <button
                        onClick={() => onDuplicateJob(job)}
                        title="Duplicate Job Settings"
                        className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-all"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Job */}
                      <button
                        onClick={() => handleDelete(jobId)}
                        title="Delete Job"
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredJobs.length === 0 && !isLoading && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 italic">
                  No jobs found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-[#90CAF9]/40 text-xs">
          <p className="text-slate-500">
            Page {page} of {totalPages} ({totalJobs} total)
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg bg-[#E3F2FD] hover:bg-[#90CAF9]/40 text-[#0D47A1] font-semibold border border-[#90CAF9] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg bg-[#E3F2FD] hover:bg-[#90CAF9]/40 text-[#0D47A1] font-semibold border border-[#90CAF9] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <NoticeModal
        isOpen={notice.isOpen}
        onClose={() => setNotice((prev) => ({ ...prev, isOpen: false }))}
        title={notice.title}
        message={notice.message}
        type={notice.type}
        confirmText={notice.confirmText}
        cancelText={notice.cancelText}
        onConfirm={notice.onConfirm}
      />
    </div>
  );
}
