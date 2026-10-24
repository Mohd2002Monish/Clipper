import { NextRequest, NextResponse } from 'next/server';
import { cleanupService } from '@/lib/services/cleanupService';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${bytes} B`;
}

// GET /api/storage/clean - returns current storage usage breakdown
export async function GET() {
  try {
    const breakdown = cleanupService.getStorageBreakdown();
    return NextResponse.json({
      success: true,
      breakdown: {
        ...breakdown,
        sessionsFormatted: formatSize(breakdown.sessionsBytes),
        uploadsFormatted: formatSize(breakdown.uploadsBytes),
        workFormatted: formatSize(breakdown.workBytes),
        outputsFormatted: formatSize(breakdown.outputsBytes),
        totalFormatted: formatSize(breakdown.totalBytes),
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

const CleanRequestSchema = z.object({
  cleanSessions: z.boolean().default(true),
  cleanWork: z.boolean().default(true),
  cleanUploads: z.boolean().default(true),
  cleanOutputs: z.boolean().default(false),
});

// POST /api/storage/clean - executes storage cleanup
export async function POST(req: NextRequest) {
  try {
    let options = {
      cleanSessions: true,
      cleanWork: true,
      cleanUploads: true,
      cleanOutputs: false,
    };

    try {
      const body = await req.json();
      options = CleanRequestSchema.parse(body);
    } catch {
      // Use defaults if empty body
    }

    const result = await cleanupService.cleanStorage(options);
    const newBreakdown = cleanupService.getStorageBreakdown();

    return NextResponse.json({
      success: true,
      message: result.freedBytes > 0
        ? `Cleaned ${result.freedFormatted} of temporary files and upload cache.`
        : 'Storage is already optimal. No temporary files were found to clean.',
      freedBytes: result.freedBytes,
      freedFormatted: result.freedFormatted,
      details: {
        sessionsRemoved: result.sessionsRemoved,
        workRemoved: result.workRemoved,
        uploadsRemoved: result.uploadsRemoved,
        outputsRemoved: result.outputsRemoved,
      },
      remaining: {
        ...newBreakdown,
        totalFormatted: formatSize(newBreakdown.totalBytes),
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
