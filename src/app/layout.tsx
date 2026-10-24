import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VideoTimmer - Splitter, Reframer & Social Publisher',
  description: 'Automated video reframing, blur-background fitting, multi-part splitting, text overlaying, and Google Drive delivery.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#E3F2FD] text-slate-800 min-h-screen selection:bg-[#2196F3] selection:text-white relative">
        <div className="ambient-glow" />
        <div className="relative z-10 flex flex-col min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
