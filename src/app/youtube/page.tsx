'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar, TabType } from '@/components/Sidebar';
import { YouTubePublisherView } from '@/components/YouTubePublisherView';
import { useRouter } from 'next/navigation';

export default function YouTubePage() {
  const router = useRouter();
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch(() => {});
  }, []);

  const handleTabChange = (tab: TabType) => {
    if (tab === 'youtube') return;
    router.push(`/?tab=${tab}`);
  };

  return (
    <div className="flex min-h-screen w-full bg-[#E3F2FD]/40">
      <Sidebar
        activeTab="youtube"
        onTabChange={handleTabChange}
        health={health}
      />
      <main className="flex-1 flex flex-col min-w-0 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 overflow-y-auto">
        <YouTubePublisherView />
      </main>
    </div>
  );
}
