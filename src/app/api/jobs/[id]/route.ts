import { NextRequest, NextResponse } from 'next/server';
import { jobService } from '@/lib/services/jobService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const jobData = await jobService.getJob(params.id);
    if (!jobData) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, ...jobData });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const deleted = await jobService.deleteJob(params.id);
    return NextResponse.json({ success: deleted });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
