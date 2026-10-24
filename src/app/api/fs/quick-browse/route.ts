import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetFolder = searchParams.get('folder') || 'workspace';
    const home = os.homedir();

    let scanDir = '';

    if (targetFolder === 'workspace') {
      scanDir = process.cwd();
    } else if (targetFolder === 'downloads') {
      scanDir = path.join(home, 'Downloads');
    } else if (targetFolder === 'movies') {
      scanDir = path.join(home, 'Movies');
    } else if (targetFolder === 'desktop') {
      scanDir = path.join(home, 'Desktop');
    } else if (targetFolder === 'documents') {
      scanDir = path.join(home, 'Documents');
    } else {
      let custom = targetFolder.trim();
      if (custom.startsWith('~/')) {
        custom = path.join(home, custom.slice(2));
      }
      scanDir = path.resolve(custom);
    }

    if (!fs.existsSync(scanDir)) {
      return NextResponse.json({
        success: false,
        error: `Directory not found: ${scanDir}`,
        currentDir: scanDir,
        videos: [],
      });
    }

    const entries = fs.readdirSync(scanDir, { withFileTypes: true });
    const videoExts = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v', '.ts']);

    const videos: Array<{
      name: string;
      fullPath: string;
      sizeBytes: number;
      sizeFormatted: string;
      modifiedAt: string;
    }> = [];

    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (videoExts.has(ext)) {
          try {
            const p = path.join(scanDir, entry.name);
            const stat = fs.statSync(p);
            const mb = (stat.size / (1024 * 1024)).toFixed(1);
            videos.push({
              name: entry.name,
              fullPath: p,
              sizeBytes: stat.size,
              sizeFormatted: `${mb} MB`,
              modifiedAt: stat.mtime.toLocaleDateString(),
            });
          } catch {
            // Ignore unreadable files
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      currentDir: scanDir,
      videos,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg, videos: [] }, { status: 500 });
  }
}
