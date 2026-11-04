'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Download,
  Filter,
  Instagram,
  AtSign,
  Facebook,
  ExternalLink,
  CheckCircle2,
  Clock,
  Send,
  Archive,
  MessageSquare,
  ShieldCheck,
  ChevronDown,
  Trash2,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { CustomSelect } from './ui/CustomSelect';
import { NoticeModal } from './ui/NoticeModal';

export interface IVaultLeadItem {
  _id: string;
  platform: 'instagram' | 'threads' | 'facebook';
  username: string;
  userDisplayName?: string;
  externalUserId?: string;
  postId?: string;
  postTitleOrHook?: string;
  commentId?: string;
  commentText: string;
  status: 'new' | 'contacted' | 'access_sent' | 'archived';
  notes?: string;
  discoveredAt: string;
  contactedAt?: string;
}

export function VaultLeadManagerView() {
  const [leads, setLeads] = useState<IVaultLeadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [metrics, setMetrics] = useState({
    total: 0,
    newLeads: 0,
    contacted: 0,
    accessSent: 0,
  });

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

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (platformFilter !== 'all') params.set('platform', platformFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/vault/leads?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, platformFilter, searchQuery]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleScanComments = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/vault/leads/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setNotice({
          isOpen: true,
          title: 'Comment Scan Complete',
          message: `Scanned ${data.scannedPostsCount} recent posts across Meta. Found ${data.newLeadsFound} new #VAULT leads!`,
          type: 'success',
        });
        fetchLeads();
      } else {
        setNotice({
          isOpen: true,
          title: 'Scan Failed',
          message: data.error || 'Failed to scan comments',
          type: 'error',
        });
      }
    } catch (err: any) {
      setNotice({
        isOpen: true,
        title: 'Network Error',
        message: String(err?.message || err),
        type: 'error',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    // Optimistic UI update
    setLeads((prev) =>
      prev.map((l) => (l._id === leadId ? { ...l, status: newStatus as any } : l))
    );

    try {
      await fetch(`/api/vault/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      fetchLeads();
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    setLeads((prev) => prev.filter((l) => l._id !== leadId));
    try {
      await fetch(`/api/vault/leads/${leadId}`, { method: 'DELETE' });
    } catch {
      fetchLeads();
    }
  };

  const copyTemplate = (username: string, leadId: string) => {
    const text = `Hey @${username}! Thanks for commenting #VAULT on our cinema recommendation. Here is your private early-access link to the curated Movie Vault: https://filmyapper.com/vault Enjoy the hidden gems!`;
    navigator.clipboard.writeText(text);
    setCopiedId(leadId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-[#90CAF9] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
              <Users className="w-5 h-5 text-purple-600" />
            </span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Movie Vault Community Lead Manager
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Automatically collects and organizes audience members who commented <code className="bg-purple-100 text-purple-800 font-mono font-bold px-1.5 py-0.5 rounded text-[11px]">#VAULT</code> on Instagram, Threads, and Facebook.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleScanComments}
            disabled={isScanning}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-md shadow-purple-600/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning Posts...' : 'Scan Live Comments'}</span>
          </button>

          <a
            href="/api/vault/leads/export"
            download
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold shadow-xs transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Captured
            </span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-0.5 block">
              {metrics.total}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
              New Leads
            </span>
            <span className="text-2xl font-black text-amber-900 font-mono mt-0.5 block">
              {metrics.newLeads}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
              Contacted
            </span>
            <span className="text-2xl font-black text-blue-900 font-mono mt-0.5 block">
              {metrics.contacted}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <Send className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
              Access Sent
            </span>
            <span className="text-2xl font-black text-emerald-900 font-mono mt-0.5 block">
              {metrics.accessSent}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filters:</span>
          </div>

          <div className="w-36">
            <CustomSelect
              value={platformFilter}
              onChange={(val) => setPlatformFilter(val)}
              size="sm"
              options={[
                { value: 'all', label: 'All Platforms' },
                { value: 'instagram', label: 'Instagram' },
                { value: 'threads', label: 'Threads' },
                { value: 'facebook', label: 'Facebook' },
              ]}
            />
          </div>

          <div className="w-36">
            <CustomSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              size="sm"
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'new', label: 'New' },
                { value: 'contacted', label: 'Contacted' },
                { value: 'access_sent', label: 'Access Sent' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
          </div>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search username, comment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all"
          />
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Platform</th>
                <th className="py-3.5 px-4">Comment Content</th>
                <th className="py-3.5 px-4">Post Context</th>
                <th className="py-3.5 px-4">Discovered</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Quick DM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {leads.map((l) => (
                <tr key={l._id} className="hover:bg-slate-50/60 transition-colors">
                  {/* User */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>@{l.username}</span>
                    </div>
                    {l.userDisplayName && (
                      <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                        {l.userDisplayName}
                      </div>
                    )}
                  </td>

                  {/* Platform */}
                  <td className="py-3.5 px-4">
                    {l.platform === 'instagram' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-50 text-pink-700 border border-pink-200">
                        <Instagram className="w-3 h-3 text-pink-600" />
                        Instagram
                      </span>
                    )}
                    {l.platform === 'threads' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        <AtSign className="w-3 h-3 text-purple-600" />
                        Threads
                      </span>
                    )}
                    {l.platform === 'facebook' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <Facebook className="w-3 h-3 text-blue-600" />
                        Facebook
                      </span>
                    )}
                  </td>

                  {/* Comment */}
                  <td className="py-3.5 px-4 max-w-xs">
                    <p className="text-slate-800 line-clamp-2 leading-relaxed font-medium">
                      {l.commentText}
                    </p>
                  </td>

                  {/* Post Context */}
                  <td className="py-3.5 px-4 max-w-[180px]">
                    <span className="text-[11px] text-slate-500 truncate block font-normal">
                      {l.postTitleOrHook || 'Cinema Post'}
                    </span>
                  </td>

                  {/* Discovered */}
                  <td className="py-3.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                    {l.discoveredAt ? new Date(l.discoveredAt).toLocaleDateString() : 'Recent'}
                  </td>

                  {/* Status Dropdown */}
                  <td className="py-3.5 px-4">
                    <select
                      value={l.status}
                      onChange={(e) => handleStatusChange(l._id, e.target.value)}
                      className={`text-[11px] font-bold px-2 py-1 rounded-lg border outline-none transition-all ${
                        l.status === 'new'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : l.status === 'contacted'
                          ? 'bg-blue-50 text-blue-800 border-blue-300'
                          : l.status === 'access_sent'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-slate-100 text-slate-600 border-slate-300'
                      }`}
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="access_sent">Access Sent</option>
                      <option value="archived">Archived</option>
                    </select>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => copyTemplate(l.username, l._id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                          copiedId === l._id
                            ? 'bg-emerald-600 text-white'
                            : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
                        }`}
                        title="Copy direct reply message"
                      >
                        {copiedId === l._id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedId === l._id ? 'Copied DM!' : 'Copy DM'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteLead(l._id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Delete lead"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {leads.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400 text-xs">
                    No leads found matching current filters. Click "Scan Live Comments" above to fetch recent #VAULT comments.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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

