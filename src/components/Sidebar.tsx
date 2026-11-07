'use client';

import React, { useState, useEffect } from 'react';
import {
  Film,
  Layers,
  History,
  Settings,
  Youtube,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Eye,
  Scissors,
  Video,
  UploadCloud,
  FileText,
  Clock,
  BarChart3,
  MessageSquare,
  AtSign,
  Instagram,
  Facebook,
  Terminal,
  Workflow,
  GitBranch,
  BookOpen,
  Compass,
  Calendar,
  Share2,
  FolderGit2,
  Users,
  Smartphone,
  HardDrive,
} from 'lucide-react';

export type TabType =
  | 'new-job'
  | 'clip-ingest'
  | 'app-leads-table'
  | 'app-vault-leads'
  | 'app-worker-status'
  | 'queue'
  | 'history'
  | 'media-library'
  | 'omni-composer'
  | 'omni-pipelines'
  | 'calendar'
  | 'vault-crm'
  | 'youtube'
  | 'uploaded-videos'
  | 'threads-composer'
  | 'threads-posts'
  | 'threads-analytics'
  | 'threads-mcp'
  | 'instagram-composer'
  | 'instagram-posts'
  | 'instagram-analytics'
  | 'facebook-composer'
  | 'facebook-posts'
  | 'facebook-analytics'
  | 'meta-guide'
  | 'settings';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  activeJobsCount?: number;
  health?: {
    status?: string;
    services?: {
      mongo?: { connected: boolean };
      googleDrive?: { configured: boolean };
    };
  };
}

interface SubMenuItem {
  id: TabType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
  badgeColor?: string;
  accent: string;
  activeBg: string;
}

interface MenuGroup {
  id: 'creation' | 'autopilot' | 'ingest' | 'channels' | string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
  badgeColor?: string;
  accent: string;
  iconBg: string;
  items: SubMenuItem[];
}

export function Sidebar({
  activeTab,
  onTabChange,
  activeJobsCount = 0,
  health,
}: SidebarProps) {
  const isHealthy = health?.status === 'healthy';
  const isMongoConnected = health?.services?.mongo?.connected ?? false;
  const isDriveConfigured = health?.services?.googleDrive?.configured ?? false;

  // Track open/collapsed state of menu groups (Studio & Auto-Pilot open by default for immediate clarity)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    creation: true,
    autopilot: true,
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const menuGroups: MenuGroup[] = [
    {
      id: 'creation',
      label: 'Studio & Creation',
      description: 'Reframe, split & render',
      icon: Scissors,
      accent: 'text-blue-400',
      iconBg: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
      badge: activeJobsCount > 0 ? `${activeJobsCount} active` : null,
      badgeColor: 'bg-emerald-500 text-white animate-pulse',
      items: [
        {
          id: 'new-job',
          label: 'Studio & Splitter',
          description: '1-Click presets, cuts & reframe',
          icon: Scissors,
          accent: 'text-blue-400',
          activeBg: 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold',
        },
        {
          id: 'media-library',
          label: 'Media Asset Library',
          description: 'Visual asset hub & rendered cuts',
          icon: FolderGit2,
          accent: 'text-cyan-400',
          badge: 'Hub',
          badgeColor: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold',
          activeBg: 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30 font-semibold',
        },
        {
          id: 'queue',
          label: 'Rendering Queue',
          description: 'Live processing tasks',
          icon: Layers,
          accent: 'text-amber-400',
          badge: activeJobsCount > 0 ? `${activeJobsCount} active` : null,
          badgeColor: 'bg-emerald-500 text-white animate-pulse',
          activeBg: 'bg-amber-600 text-white shadow-md shadow-amber-600/30 font-semibold',
        },
        {
          id: 'history',
          label: 'Render History',
          description: 'Completed video parts',
          icon: History,
          accent: 'text-indigo-400',
          activeBg: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold',
        },
      ],
    },
    {
      id: 'autopilot',
      label: 'Auto-Pilot & Post',
      description: 'Multi-channel syndication',
      icon: Share2,
      accent: 'text-purple-400',
      iconBg: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
      badge: 'Auto',
      badgeColor: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold',
      items: [
        {
          id: 'omni-pipelines',
          label: 'Auto-Pilot Pipelines',
          description: 'Drive folder to all channels',
          icon: Layers,
          accent: 'text-sky-400',
          badge: 'Auto',
          badgeColor: 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold',
          activeBg: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30 font-semibold',
        },
        {
          id: 'omni-composer',
          label: 'Omni-Post Studio',
          description: '1 Video to 4 channels cross-post',
          icon: Share2,
          accent: 'text-purple-400',
          badge: 'Omni',
          badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold',
          activeBg: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-600/30 font-semibold',
        },
        {
          id: 'calendar',
          label: 'Visual Calendar',
          description: '5 Golden slots schedule grid',
          icon: Calendar,
          accent: 'text-amber-400',
          badge: '5 Slots',
          badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold',
          activeBg: 'bg-amber-600 text-white shadow-md shadow-amber-600/30 font-semibold',
        },
      ],
    },
    {
      id: 'ingest',
      label: 'Ingest & Leads',
      description: 'Downloads & audience CRM',
      icon: Smartphone,
      accent: 'text-sky-400',
      iconBg: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
      badge: 'Hub',
      badgeColor: 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold',
      items: [
        {
          id: 'clip-ingest',
          label: 'Ingested Clips Table',
          description: 'IDM downloads & mobile queue',
          icon: Smartphone,
          accent: 'text-sky-400',
          badge: 'Queue',
          badgeColor: 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold',
          activeBg: 'bg-sky-600 text-white shadow-md shadow-sky-600/30 font-semibold',
        },
        {
          id: 'vault-crm',
          label: 'Movie Vault CRM',
          description: 'Track #VAULT leads & outreach',
          icon: Users,
          accent: 'text-emerald-400',
          badge: 'Leads',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold',
          activeBg: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-semibold',
        },
      ],
    },
    {
      id: 'channels',
      label: 'Channels & Hubs',
      description: 'Platform deep-dive studios',
      icon: Youtube,
      accent: 'text-rose-400',
      iconBg: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
      badge: 'Channels',
      badgeColor: 'bg-slate-800 text-slate-300 font-semibold',
      items: [
        {
          id: 'youtube',
          label: 'YouTube Studio',
          description: 'Drive upload, Shorts & views',
          icon: Youtube,
          accent: 'text-red-400',
          badge: 'Shorts',
          badgeColor: 'bg-red-500 text-white font-bold',
          activeBg: 'bg-red-600 text-white shadow-md shadow-red-600/30 font-semibold',
        },
        {
          id: 'instagram-composer',
          label: 'Instagram Studio',
          description: 'Reels composer & queue',
          icon: Instagram,
          accent: 'text-pink-400',
          badge: 'Reels',
          badgeColor: 'bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold',
          activeBg: 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-600/30 font-semibold',
        },
        {
          id: 'threads-composer',
          label: 'Threads Studio',
          description: 'Drafts, queue & analytics',
          icon: AtSign,
          accent: 'text-purple-400',
          activeBg: 'bg-purple-600 text-white shadow-md shadow-purple-600/30 font-semibold',
        },
        {
          id: 'facebook-composer',
          label: 'Facebook Studio',
          description: 'Page posts & video queue',
          icon: Facebook,
          accent: 'text-blue-400',
          activeBg: 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold',
        },
        {
          id: 'settings',
          label: 'Settings & Integrations',
          description: 'API keys, accounts & setup',
          icon: Settings,
          accent: 'text-slate-400',
          activeBg: 'bg-slate-700 text-white shadow-md font-semibold',
        },
      ],
    },
  ];

  // Auto-open group containing active tab
  useEffect(() => {
    const parentGroup = menuGroups.find((g) => g.items.some((i) => i.id === activeTab));
    if (parentGroup) {
      setOpenGroups((prev) => ({ ...prev, [parentGroup.id]: true }));
    }
  }, [activeTab]);

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 min-h-screen text-slate-300 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-base tracking-tight">VideoTimmer</span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                v1.2
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Split, Brand & Publish</p>
          </div>
        </div>
      </div>

      {/* Main Hierarchical Navigation */}
      <div className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Navigation
        </div>

        {/* Grouped Menus with Submenus */}
        <div className="space-y-3">
          {menuGroups.map((group) => {
            const GroupIcon = group.icon;
            const isOpen = !!openGroups[group.id];
            const isGroupActive = group.items.some((item) => item.id === activeTab);

            return (
              <div key={group.id} className="space-y-1">
                {/* Parent Menu Header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-150 group ${
                    isGroupActive
                      ? 'bg-slate-800/90 text-white border border-slate-700/60 shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
                  }`}
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`p-1.5 rounded-lg transition-colors ${
                        isGroupActive ? group.iconBg : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
                      }`}
                    >
                      <GroupIcon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-semibold leading-none flex items-center gap-1.5 text-slate-200 group-hover:text-white">
                        {group.label}
                        {isGroupActive && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              group.id === 'creation'
                                ? 'bg-blue-400'
                                : group.id === 'autopilot'
                                ? 'bg-purple-400'
                                : group.id === 'ingest'
                                ? 'bg-sky-400'
                                : 'bg-rose-400'
                            }`}
                            title="Active section"
                          />
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 leading-none truncate">
                        {group.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {group.badge && (
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold ${
                          group.badgeColor || 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {group.badge}
                      </span>
                    )}
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                  </div>
                </button>

                {/* Submenu Items Container (Tree Style) */}
                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="ml-4 pl-3 border-l-2 border-slate-800 space-y-1 py-1">
                    {group.items.map((sub) => {
                      const SubIcon = sub.icon;
                      const isActive = activeTab === sub.id;

                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => onTabChange(sub.id)}
                          className={`w-full text-left flex items-center justify-between px-2.5 py-2 rounded-xl transition-all duration-150 group ${
                            isActive
                              ? sub.activeBg
                              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`p-1.5 rounded-lg transition-colors ${
                                isActive
                                  ? 'bg-white/20 text-white'
                                  : 'bg-slate-800/80 group-hover:bg-slate-800 ' + sub.accent
                              }`}
                            >
                              <SubIcon className="w-3.5 h-3.5" />
                            </div>
                            <div className="truncate">
                              <div className="text-xs font-medium leading-none">{sub.label}</div>
                              <div
                                className={`text-[10px] mt-1 leading-none truncate ${
                                  isActive ? 'text-white/80' : 'text-slate-400'
                                }`}
                              >
                                {sub.description}
                              </div>
                            </div>
                          </div>

                          {sub.badge && (
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ml-1 font-semibold ${
                                sub.badgeColor || 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {sub.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* System & Settings Section */}
        <div className="pt-2 border-t border-slate-800/60 space-y-1">
          <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            System & Settings
          </div>
          <button
            type="button"
            onClick={() => onTabChange('settings')}
            className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 group ${
              activeTab === 'settings' || activeTab === 'meta-guide' || activeTab === 'threads-mcp'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`p-1.5 rounded-lg transition-colors ${
                  activeTab === 'settings' || activeTab === 'meta-guide' || activeTab === 'threads-mcp'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-800/80 group-hover:bg-slate-800 text-blue-400'
                }`}
              >
                <Settings className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="text-xs font-medium leading-none">Settings & Docs</div>
                <div
                  className={`text-[10px] mt-1 leading-none truncate ${
                    activeTab === 'settings' || activeTab === 'meta-guide' || activeTab === 'threads-mcp'
                      ? 'text-blue-100'
                      : 'text-slate-400'
                  }`}
                >
                  Meta Guide, MCP & Logs
                </div>
              </div>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Hub
            </span>
          </button>
        </div>
      </div>

      {/* System Health Card */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        <div className="bg-slate-800/70 rounded-xl p-3 border border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              Engine Status
            </span>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                isHealthy
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              {isHealthy ? 'Healthy' : 'Degraded'}
            </span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between text-slate-400">
              <span>Database:</span>
              <span className="flex items-center gap-1 font-mono text-slate-300">
                {isMongoConnected ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Atlas Live
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3 text-amber-400" /> Disconnected
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Google Drive:</span>
              <span className="flex items-center gap-1 font-mono text-slate-300">
                {isDriveConfigured ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Ready
                  </>
                ) : (
                  <span className="text-slate-400">Not configured</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
