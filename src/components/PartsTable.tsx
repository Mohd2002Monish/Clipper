'use client';

import React from 'react';
import { PartPlan } from '@/shared/schemas';
import { Clock, Film, AlertTriangle, CheckCircle2, Plus, Trash2, ArrowRight } from 'lucide-react';

interface PartsTableProps {
  plan: PartPlan[];
  warnings?: string[];
  adjustments?: string[];
  isCustomMode?: boolean;
  onAddCustomRow?: () => void;
  onRemoveCustomRow?: (id: string) => void;
  onUpdateCustomRow?: (id: string, field: 'start' | 'end', val: number) => void;
  customRows?: Array<{ id: string; start: number; end: number }>;
}

export function PartsTable({
  plan,
  warnings = [],
  adjustments = [],
  isCustomMode = false,
  onAddCustomRow,
  onRemoveCustomRow,
  onUpdateCustomRow,
  customRows = [],
}: PartsTableProps) {
  const formatTime = (seconds: number) => {
    const s = Math.max(0, seconds);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    const wholeSecs = Math.floor(secs);
    const ms = Math.round((secs - wholeSecs) * 1000);
    return `${String(mins).padStart(2, '0')}:${String(wholeSecs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Warnings & Adjustment Badges */}
      {(warnings.length > 0 || adjustments.length > 0) && (
        <div className="flex flex-col gap-2">
          {adjustments.map((adj, i) => (
            <div
              key={`adj-${i}`}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-[#E3F2FD] border border-[#90CAF9] text-[#0D47A1] text-xs font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2196F3]" />
              <span>{adj}</span>
            </div>
          ))}
          {warnings.map((warn, i) => (
            <div
              key={`warn-${i}`}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      {/* Custom Mode Timestamp Editor */}
      {isCustomMode && (
        <div className="bg-[#F0F7FF] p-4 rounded-xl border border-[#90CAF9]/60 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[#0D47A1] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#2196F3]" />
              Custom Timestamp Rows
            </h4>
            <button
              onClick={onAddCustomRow}
              className="btn-pressable flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2196F3] hover:bg-[#1E88E5] text-white text-xs font-bold shadow-md shadow-[#2196F3]/25"
            >
              <Plus className="w-3 h-3" />
              Add Segment
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {customRows.map((row, index) => (
              <div
                key={row.id}
                className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-[#90CAF9]/60 shadow-sm"
              >
                <span className="text-xs font-bold font-mono text-[#0D47A1] w-16">
                  Part {index + 1}
                </span>

                <div className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 uppercase font-mono font-bold">Start</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={row.start}
                      onChange={(e) => onUpdateCustomRow?.(row.id, 'start', parseFloat(e.target.value) || 0)}
                      className="w-20 bg-white border border-[#90CAF9] rounded px-2 py-1 text-xs text-[#0D47A1] font-mono font-bold text-center focus:outline-none focus:border-[#2196F3]"
                    />
                    <span className="text-[10px] text-slate-500 font-semibold">s</span>
                  </div>

                  <ArrowRight className="w-3.5 h-3.5 text-[#90CAF9] shrink-0" />

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 uppercase font-mono font-bold">End</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={row.end}
                      onChange={(e) => onUpdateCustomRow?.(row.id, 'end', parseFloat(e.target.value) || 0)}
                      className="w-20 bg-white border border-[#90CAF9] rounded px-2 py-1 text-xs text-[#0D47A1] font-mono font-bold text-center focus:outline-none focus:border-[#2196F3]"
                    />
                    <span className="text-[10px] text-slate-500 font-semibold">s</span>
                  </div>

                  <span className="text-[11px] text-slate-600 font-mono font-semibold ml-auto">
                    {Math.max(0, Math.round((row.end - row.start) * 10) / 10)}s duration
                  </span>
                </div>

                <button
                  disabled={customRows.length <= 1}
                  onClick={() => onRemoveCustomRow?.(row.id)}
                  className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Parts Table Preview */}
      <div className="overflow-hidden rounded-xl border border-[#90CAF9]/60 bg-white shadow-sm">
        <div className="px-4 py-3 bg-[#F0F7FF] border-b border-[#90CAF9]/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-[#2196F3]" />
            <h4 className="text-xs font-bold text-[#0D47A1] uppercase tracking-wider">
              Parts Plan Preview ({plan.length} Total Parts)
            </h4>
          </div>
          <span className="text-[11px] text-slate-500 font-mono font-semibold">Live Computed</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#E3F2FD]/70 text-[#0D47A1] uppercase text-[10px] font-mono font-bold border-b border-[#90CAF9]/40">
              <tr>
                <th className="py-2.5 px-4 font-bold">Part #</th>
                <th className="py-2.5 px-4 font-bold">Start Timestamp</th>
                <th className="py-2.5 px-4 font-bold">End Timestamp</th>
                <th className="py-2.5 px-4 font-bold">Duration</th>
                <th className="py-2.5 px-4 font-bold">Output Filename</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#90CAF9]/30 font-mono">
              {plan.map((part) => (
                <tr key={part.index} className="hover:bg-[#F0F7FF]/50 transition-colors">
                  <td className="py-2.5 px-4 font-bold text-[#0D47A1]">
                    Part {String(part.index).padStart(2, '0')}
                  </td>
                  <td className="py-2.5 px-4 text-slate-700 font-medium">
                    {formatTime(part.start)}{' '}
                    <span className="text-[10px] text-slate-400">({part.start}s)</span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-700 font-medium">
                    {formatTime(part.end)}{' '}
                    <span className="text-[10px] text-slate-400">({part.end}s)</span>
                  </td>
                  <td className="py-2.5 px-4 font-bold text-emerald-700">
                    {part.duration.toFixed(2)}s
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 truncate max-w-[200px]" title={part.filename}>
                    {part.filename}
                  </td>
                </tr>
              ))}
              {plan.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                    No parts computed yet. Upload a video or enter valid split values.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
