import { NextResponse } from 'next/server';
import { driveService } from '@/lib/services/driveService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const authUrl = driveService.getAuthUrl();
    return NextResponse.json({ success: true, authUrl });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
  }
}
