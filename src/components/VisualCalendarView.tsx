'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Youtube,
  Instagram,
  AtSign,
  Facebook,
  ExternalLink,
  Plus,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Layers,
} from 'lucide-react';
import { CustomSelect } from './ui/CustomSelect';
import { NoticeModal } from './ui/NoticeModal';

export interface CalendarPostEvent {
  id: string;
  platform: 'youtube' | 'instagram' | 'threads' | 'facebook';
  status: 'scheduled' | 'published';
  time: string;
  titleOrText: string;
  usernameOrChannel: string;
  mediaUrl?: string;
  permalink?: string;
}

interface GoldenSlotGuide {
  hour: number;
  label: string;
  niche: string;
}

export function VisualCalendarView() {
  const [events, setEvents] = useState<CalendarPostEvent[]>([]);
  const [goldenSlots, setGoldenSlots] = useState<GoldenSlotGuide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

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

  const getWeekDays = (offsetWeeks: number) => {
    const today = new Date();
    // Monday as start of week
    const currentDay = today.getDay();
    const distanceToMonday = (currentDay + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday + offsetWeeks * 7);
    monday.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const weekDays = getWeekDays(currentWeekOffset);

  const fetchCalendar = useCallback(async () => {
    setIsLoading(true);
    try {
      const start = weekDays[0].toISOString();
      const end = new Date(weekDays[6].getTime() + 24 * 60 * 60 * 1000).toISOString();

      const res = await fetch(`/api/calendar/slots?start=${start}&end=${end}`);
      const data = await res.json();
      if (data.success) {
        setEvents(data.events || []);
        if (data.goldenSlots) setGoldenSlots(data.goldenSlots);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, [currentWeekOffset]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const filteredEvents = events.filter((e) => {
    if (platformFilter !== 'all' && e.platform !== platformFilter) return false;
    return true;
  });

  const getEventsForDayAndHour = (day: Date, targetHour: number) => {
    return filteredEvents.filter((e) => {
      const d = new Date(e.time);
      const isSameDay =
        d.getFullYear() === day.getFullYear() &&
        d.getMonth() === day.getMonth() &&
        d.getDate() === day.getDate();
      return isSameDay && d.getHours() === targetHour;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#90CAF9] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
              <CalendarIcon className="w-5 h-5 text-indigo-600" />
            </span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Master Cross-Platform Visual Scheduling Calendar
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Interactive matrix mapping your posts to the 5 daily golden cinema slots (9 AM, 2 PM, 9 PM, 11 PM, 1 AM) across Instagram, Threads, Facebook, and YouTube.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchCalendar}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Week Navigator & Platform Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Week navigation buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentWeekOffset((prev) => prev - 1)}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
            title="Previous Week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-bold text-slate-800 px-3 py-1.5 rounded-xl bg-slate-100 font-mono">
            {weekDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
            {weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>

          <button
            type="button"
            onClick={() => setCurrentWeekOffset((prev) => prev + 1)}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
            title="Next Week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {currentWeekOffset !== 0 && (
            <button
              type="button"
              onClick={() => setCurrentWeekOffset(0)}
              className="text-xs font-bold px-2.5 py-1 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
            >
              Current Week
            </button>
          )}
        </div>

        {/* Platform filter buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            Filter:
          </span>
          {[
            { id: 'all', label: 'All Channels' },
            { id: 'threads', label: 'Threads', icon: AtSign, color: 'text-purple-600' },
            { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-600' },
            { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-600' },
            { id: 'youtube', label: 'YouTube', icon: Youtube, color: 'text-red-600' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPlatformFilter(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                platformFilter === item.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {item.icon && <item.icon className={`w-3.5 h-3.5 ${item.color}`} />}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 7-Day Calendar Grid */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center">
          {weekDays.map((day, idx) => {
            const isToday = day.toDateString() === new Date().toDateString();
            return (
              <div
                key={idx}
                className={`p-3 border-r border-slate-200 last:border-r-0 ${
                  isToday ? 'bg-blue-50/70 text-blue-900 font-black' : 'text-slate-600'
                }`}
              >
                <span className="text-[10px] uppercase font-bold tracking-wider block">
                  {day.toLocaleDateString(undefined, { weekday: 'short' })}
                </span>
                <span className="text-sm font-bold block mt-0.5">
                  {day.toLocaleDateString(undefined, { day: 'numeric' })}
                </span>
              </div>
            );
          })}
        </div>

        {/* Golden Slot Rows */}
        <div className="divide-y divide-slate-100">
          {(goldenSlots.length > 0
            ? goldenSlots
            : [
                { hour: 9, label: '09:00 AM', niche: 'Indian / Bollywood' },
                { hour: 14, label: '02:00 PM', niche: 'Indian / Bollywood' },
                { hour: 21, label: '09:00 PM', niche: 'Hollywood / International' },
                { hour: 23, label: '11:00 PM', niche: 'Hollywood / International' },
                { hour: 1, label: '01:00 AM', niche: 'Hollywood / International' },
              ]
          ).map((slot, sIdx) => (
            <div key={sIdx} className="grid grid-cols-7 divide-x divide-slate-100">
              {weekDays.map((day, dIdx) => {
                const slotEvents = getEventsForDayAndHour(day, slot.hour);
                return (
                  <div key={dIdx} className="p-2.5 min-h-[110px] flex flex-col gap-1.5 hover:bg-slate-50/50 transition-colors">
                    {/* Slot Header Label */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{slot.label}</span>
                      <span className="text-[9px] text-slate-400 truncate max-w-[65px]">{slot.niche}</span>
                    </div>

                    {/* Slot Scheduled / Published Events */}
                    {slotEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className={`p-2 rounded-xl border text-[11px] leading-tight flex flex-col gap-1 transition-all ${
                          evt.platform === 'threads'
                            ? 'bg-purple-50/80 border-purple-200 text-purple-950'
                            : evt.platform === 'instagram'
                            ? 'bg-pink-50/80 border-pink-200 text-pink-950'
                            : evt.platform === 'facebook'
                            ? 'bg-blue-50/80 border-blue-200 text-blue-950'
                            : 'bg-red-50/80 border-red-200 text-red-950'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold flex items-center gap-1">
                            {evt.platform === 'threads' && <AtSign className="w-3 h-3 text-purple-600" />}
                            {evt.platform === 'instagram' && <Instagram className="w-3 h-3 text-pink-600" />}
                            {evt.platform === 'facebook' && <Facebook className="w-3 h-3 text-blue-600" />}
                            {evt.platform === 'youtube' && <Youtube className="w-3 h-3 text-red-600" />}
                            <span>{evt.usernameOrChannel}</span>
                          </span>

                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                              evt.status === 'published'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {evt.status === 'published' ? 'Live' : 'Slot'}
                          </span>
                        </div>

                        <p className="text-[10px] line-clamp-2 text-slate-700 font-medium">
                          {evt.titleOrText}
                        </p>
                      </div>
                    ))}

                    {/* Empty Slot Placeholder */}
                    {slotEvents.length === 0 && (
                      <div className="flex-1 border border-dashed border-slate-200/80 rounded-xl p-1.5 flex items-center justify-center text-slate-300 hover:border-blue-300 hover:text-blue-500 transition-colors">
                        <span className="text-[10px] font-medium">Open Slot</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
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

