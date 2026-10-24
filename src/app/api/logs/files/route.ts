import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!fs.existsSync(config.logDir)) {
      return NextResponse.json({ success: true, files: [] });
    }

    const entries = fs.readdirSync(config.logDir, { withFileTypes: true });
    const logFiles = entries
      .filter((e) => e.isFile() && e.name.endsWith('.log'))
      .map((e) => {
        const fullPath = path.join(config.logDir, e.name);
        const stats = fs.statSync(fullPath);
        return {
          name: e.name,
          channel: e.name.replace('.log', ''),
          sizeBytes: stats.size,
          updatedAt: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return NextResponse.json({ success: true, files: logFiles });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
