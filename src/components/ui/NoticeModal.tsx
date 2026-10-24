'use client';

import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export type NoticeType = 'info' | 'success' | 'warning' | 'error';

export interface NoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: NoticeType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
}

export const NoticeModal: React.FC<NoticeModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  cancelText,
  onConfirm,
}) => {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const iconMap = {
    info: <Info className="w-6 h-6 text-blue-500" />,
    success: <CheckCircle2 className="w-6 h-6 text-emerald-500" />,
    warning: <AlertTriangle className="w-6 h-6 text-amber-500" />,
    error: <AlertCircle className="w-6 h-6 text-red-500" />,
  };

  const bgMap = {
    info: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900',
    success: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900',
    warning: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900',
    error: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900',
  };

  const defaultTitleMap = {
    info: 'Information',
    success: 'Success',
    warning: 'Attention',
    error: 'Notice',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl border shrink-0 ${bgMap[type]}`}>
            {iconMap[type]}
          </div>
          <div className="flex-1 space-y-1 pt-0.5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {title || defaultTitleMap[type]}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          {cancelText && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (onConfirm) {
                onConfirm();
              }
              onClose();
            }}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
