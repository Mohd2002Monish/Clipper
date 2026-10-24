import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    let filename = params.name;
    if (!filename.endsWith('.log')) {
      filename += '.log';
    }

    // Sanitize against directory traversal
    const safeName = path.basename(filename);
    if (safeName !== filename || safeName.includes('..')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const filePath = path.join(config.logDir, safeName);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Log file not found' }, { status: 404 });
    }

    const searchParams = req.nextUrl.searchParams;
    const limit = Math.min(500, parseInt(searchParams.get('limit') || '200', 10));
    const levelFilter = searchParams.get('level')?.toLowerCase();
    const searchQuery = searchParams.get('search')?.toLowerCase();

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n').filter((l) => l.trim().length > 0);

    const parsedLogs = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        entry = {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: line,
        };
      }

      if (levelFilter && levelFilter !== 'all' && entry.level?.toLowerCase() !== levelFilter) {
        continue;
      }

      if (searchQuery) {
        const textToSearch = `${entry.event || ''} ${entry.message || ''} ${entry.jobId || ''}`.toLowerCase();
        if (!textToSearch.includes(searchQuery)) {
          continue;
        }
      }

      parsedLogs.push(entry);
      if (parsedLogs.length >= limit) break;
    }

    return NextResponse.json({
      success: true,
      filename: safeName,
      totalFound: parsedLogs.length,
      logs: parsedLogs,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
