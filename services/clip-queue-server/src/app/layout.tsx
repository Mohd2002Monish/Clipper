import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clip Queue Ingestion Cloud',
  description: 'Serverless Video Ingestion and Google Drive Staging API',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}

