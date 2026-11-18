import { NextResponse } from 'next/server';
import { driveService } from '@/lib/services/driveService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await driveService.getStorageQuota();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
