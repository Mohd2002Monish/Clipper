import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { jobService } from '@/lib/services/jobService';
import { JobCreateRequestSchema } from '@/shared/schemas';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let validated;
  try {
    const body = await req.json();
    validated = JobCreateRequestSchema.parse(body);
  } catch (valErr: unknown) {
    const errorMsg = valErr instanceof Error ? valErr.message : String(valErr);
    return NextResponse.json({ error: `Validation error: ${errorMsg}` }, { status: 400 });
  }

  try {
    const storedPath =
      fs.existsSync(validated.sourceFileId)
        ? validated.sourceFileId
        : path.isAbsolute(validated.sourceFileId)
        ? validated.sourceFileId
        : path.join(config.uploadsDir, validated.sourceFileId);

    const { job, parts } = await jobService.createJob({
      sourceStoredPath: storedPath,
      originalFilename: validated.originalFilename,
      folderName: validated.folderName || validated.outputFormat.folderName || 'General',
      outputFormat: validated.outputFormat,
      splitSettings: validated.splitSettings,
      textOverlay: validated.textOverlay,
      aiSubtitles: validated.aiSubtitles,
    });

    return NextResponse.json({
      success: true,
      jobId: String(job._id),
      job,
      parts,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const status = searchParams.get('status') || 'all';
    const folder = searchParams.get('folder') || 'all';

    const result = await jobService.listJobs({ page, limit, status, folder });
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
