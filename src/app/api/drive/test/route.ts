import { NextRequest, NextResponse } from 'next/server';
import { driveService } from '@/lib/services/driveService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let folderId: string | undefined;
    try {
      const body = await req.json();
      folderId = body.folderId;
    } catch {
      // Body is optional
    }

    const result = await driveService.testConnection(folderId);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
