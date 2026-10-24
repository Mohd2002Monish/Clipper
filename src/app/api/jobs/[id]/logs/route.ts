import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const jobLogPath = path.join(config.logDir, 'jobs', `${jobId}.log`);

    if (!fs.existsSync(jobLogPath)) {
      return NextResponse.json({ logs: [] });
    }

    const fileContent = fs.readFileSync(jobLogPath, 'utf8');
    const lines = fileContent.split('\n').filter((l) => l.trim().length > 0);

    const logs = [];
    for (const line of lines) {
      try {
        logs.push(JSON.parse(line));
      } catch {
        // Raw line fallback if non-JSON line exists
        logs.push({
          timestamp: new Date().toISOString(),
          level: 'info',
          channel: 'render',
          message: line,
        });
      }
    }

    return NextResponse.json({
      success: true,
      jobId,
      totalLines: logs.length,
      logs: logs.slice(-200), // Return last 200 log entries
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
