import { NextRequest, NextResponse } from 'next/server';
import { youtubeAutomationService } from '@/lib/services/youtubeAutomationService';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await youtubeAutomationService.runHourlyUploadCycle();
    return NextResponse.json({
      success: true,
      result,
      message: `Triggered auto-pilot upload cycle: ${result.uploaded} uploaded, ${result.skipped} skipped.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
