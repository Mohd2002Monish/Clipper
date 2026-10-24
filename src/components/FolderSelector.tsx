'use client';

import React, { useState, useEffect } from 'react';
import {
  Folder as FolderIcon,
  Plus,
  FolderPlus,
  Check,
  ChevronDown,
  Sparkles,
  Layers,
  X,
  Loader2,
  HardDrive
} from 'lucide-react';
import { IFolder } from '@/shared/types';

interface FolderSelectorProps {
  selectedFolder: string;
  onSelectFolder: (folderName: string) => void;
  className?: string;
  variant?: 'compact' | 'full';
}

const COLOR_OPTIONS = [
  '#2196F3', // Blue
  '#10B981', // Emerald Green
  '#7C3AED', // Violet / Purple
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#0288D1', // Deep Cyan
  '#EC4899', // Pink
  '#64748B', // Slate
];

export function FolderSelector({
  selectedFolder,
  onSelectFolder,
  className = '',
  variant = 'full',
}: FolderSelectorProps) {
  const [folders, setFolders] = useState<IFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New folder form state
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#2196F3');
  const [newFolderDesc, setNewFolderDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchFolders = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/folders');
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
        // If current selected folder is empty or not set, default to first or General
        if (!selectedFolder && data.folders?.length > 0) {
          onSelectFolder(data.folders[0].name);
        }
      }
    } catch {
      // Fallback
      setFolders([{ name: 'General', slug: 'general', color: '#2196F3', jobCount: 0 }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  const handleCreateFolder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setCreateError('Please enter a folder name');
      return;
    }

    try {
      setIsCreating(true);
      setCreateError(null);
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          color: newFolderColor,
          description: newFolderDesc.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create folder');
      }

      await fetchFolders();
      onSelectFolder(data.folder.name);
      setNewFolderName('');
      setNewFolderDesc('');
      setShowCreateModal(false);
      setIsOpen(false);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Error creating folder');
    } finally {
      setIsCreating(false);
    }
  };

  const activeFolderObj = folders.find((f) => f.name === selectedFolder) || {
    name: selectedFolder || 'General',
    color: '#2196F3',
    jobCount: 0,
  };

  return (
    <div className={`relative ${className}`}>
      {/* Selector Button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 flex items-center justify-between px-3.5 py-2.5 bg-white border border-[#90CAF9] rounded-xl text-left shadow-sm hover:border-[#2196F3] hover:bg-[#F0F7FF] transition-all btn-pressable group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-xs"
              style={{ backgroundColor: activeFolderObj.color || '#2196F3' }}
            />
            <div className="truncate">
              <span className="text-xs font-bold text-[#0D47A1] block truncate">
                {activeFolderObj.name}
              </span>
              {variant === 'full' && (
                <span className="text-[10px] text-slate-500 block truncate">
                  {activeFolderObj.jobCount ? `${activeFolderObj.jobCount} videos saved` : '0 videos saved'}
                </span>
              )}
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-500 group-hover:text-[#2196F3] transition-transform ${
              isOpen ? 'rotate-180 text-[#2196F3]' : ''
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            setShowCreateModal(true);
            setCreateError(null);
          }}
          className="px-3 py-2.5 bg-[#2196F3] hover:bg-[#1E88E5] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-[#2196F3]/30 transition-all btn-pressable flex-shrink-0"
          title="Create New Folder"
        >
          <FolderPlus className="w-4 h-4" />
          <span className="hidden sm:inline">New Folder</span>
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-[#90CAF9] rounded-xl shadow-xl overflow-hidden py-1.5 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
            <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <span>Select Video Folder</span>
              <span className="text-[10px] text-[#2196F3] font-medium">{folders.length} available</span>
            </div>

            {isLoading ? (
              <div className="p-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-[#2196F3]" /> Loading folders...
              </div>
            ) : folders.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">
                No folders found. Create one to organize your videos!
              </div>
            ) : (
              folders.map((folder) => {
                const isSelected = folder.name === selectedFolder;
                return (
                  <button
                    key={folder.name}
                    type="button"
                    onClick={() => {
                      onSelectFolder(folder.name);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                      isSelected
                        ? 'bg-[#E3F2FD] text-[#0D47A1] font-bold'
                        : 'text-slate-700 hover:bg-[#F0F7FF]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: folder.color || '#2196F3' }}
                      />
                      <span className="truncate">{folder.name}</span>
                      {folder.description && (
                        <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                          • {folder.description}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                        {folder.jobCount || 0}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-[#2196F3]" />}
                    </div>
                  </button>
                );
              })
            )}

            <div className="p-1.5 border-t border-slate-100 bg-[#F0F7FF]/60">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowCreateModal(true);
                  setCreateError(null);
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold text-[#0D47A1] hover:text-[#2196F3] transition-colors rounded-lg hover:bg-white"
              >
                <Plus className="w-3.5 h-3.5 text-[#2196F3]" /> Create New Custom Folder
              </button>
            </div>
          </div>
        </>
      )}

      {/* Path Breadcrumb hint */}
      {variant === 'full' && (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500 font-medium truncate">
          <HardDrive className="w-3 h-3 text-[#2196F3] flex-shrink-0" />
          <span className="truncate">
            Destination: <code className="text-[#0D47A1] bg-[#E3F2FD] px-1.5 py-0.5 rounded font-mono font-bold">storage/outputs/{activeFolderObj.name}/...</code> &amp; Drive
          </span>
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-[#90CAF9] shadow-2xl w-full max-w-md p-6 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-[#0D47A1]">
                <FolderPlus className="w-5 h-5 text-[#2196F3]" />
                <h3 className="text-sm font-bold">Create New Video Folder</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0D47A1] mb-1">
                  Folder Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Series Season 1, YouTube Shorts, Client A"
                  autoFocus
                  required
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-[#90CAF9] rounded-xl focus:outline-none focus:border-[#2196F3] focus:ring-2 focus:ring-[#2196F3]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0D47A1] mb-1.5">
                  Folder Badge Color
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewFolderColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        newFolderColor === c
                          ? 'border-slate-800 scale-110 shadow-sm'
                          : 'border-white hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0D47A1] mb-1">
                  Description / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={newFolderDesc}
                  onChange={(e) => setNewFolderDesc(e.target.value)}
                  placeholder="e.g. 1080p vertical edits for Instagram"
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-[#90CAF9] rounded-xl focus:outline-none focus:border-[#2196F3] focus:ring-2 focus:ring-[#2196F3]/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-[#2196F3] hover:bg-[#1E88E5] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#2196F3]/30 transition-all disabled:opacity-50"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" /> Create &amp; Select
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
