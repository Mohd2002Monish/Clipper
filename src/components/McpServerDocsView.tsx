'use client';

import React, { useState } from 'react';
import {
  Terminal,
  RefreshCw,
  Check,
  Copy,
  Globe,
  Sparkles,
  Cpu,
  CheckCircle2,
  Layers,
  Zap,
} from 'lucide-react';

export function McpServerDocsView() {
  const [mcpConsoleLoading, setMcpConsoleLoading] = useState(false);
  const [mcpConsoleOutput, setMcpConsoleOutput] = useState<string | null>(null);
  const [mcpPingMs, setMcpPingMs] = useState<number | null>(null);
  const [mcpCopiedUrl, setMcpCopiedUrl] = useState(false);
  const [mcpCopiedStdio, setMcpCopiedStdio] = useState(false);
  const [mcpCopiedConfig, setMcpCopiedConfig] = useState(false);

  const handleTestMcp = async (method: string, params: Record<string, any> = {}) => {
    setMcpConsoleLoading(true);
    const start = performance.now();
    try {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'test_' + Date.now(),
          method,
          params,
        }),
      });
      const data = await res.json();
      const elapsed = Math.round(performance.now() - start);
      setMcpPingMs(elapsed);
      setMcpConsoleOutput(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setMcpConsoleOutput(
        JSON.stringify(
          {
            error: 'Failed to communicate with MCP server',
            details: String(err?.message || err),
          },
          null,
          2
        )
      );
    } finally {
      setMcpConsoleLoading(false);
    }
  };

  const registeredTools = [
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
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 rounded-3xl p-6 lg:p-8 text-white border border-purple-900/50 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                MCP Server Active
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
              Model Context Protocol (MCP) Bridge
            </h2>
            <p className="text-xs text-purple-200/80 leading-relaxed">
              Direct AI bridge enabling Antigravity, Claude, and local automation agents to create, schedule, reschedule, and monitor social content natively.
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
              <span className="font-bold">No API key required locally:</span> Accepts standard requests or any optional <code className="font-mono bg-purple-100 px-1 py-0.5 rounded text-[10px]">x-api-key</code> for seamless backward compatibility with existing agent configurations.
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
              <span className="font-bold">Drop-in Replacement:</span> You can also name the server key <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded text-[10px]">blacktwist</code> in your config so existing agent prompts, scheduled routines, and memories execute instantly with 0 changes.
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

      {/* Supported Tools Directory */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Registered MCP Tools ({registeredTools.length} Tools)</h3>
            <p className="text-xs text-slate-400">
              Universal tools available to AI assistants for content creation, scheduling, and metrics
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 font-mono">
            {registeredTools.length} Tools Available
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {registeredTools.map((tool, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 transition-all space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-purple-950 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                  {tool.name}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                  {tool.tag}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">{tool.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

