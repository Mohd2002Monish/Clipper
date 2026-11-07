import { NextRequest, NextResponse } from 'next/server';
import { omniPipelineService } from '@/lib/services/omniPipelineService';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pipelineId = params.id;
    if (!pipelineId) {
      return NextResponse.json({ success: false, error: 'Pipeline ID is required.' }, { status: 400 });
    }

    const result = await omniPipelineService.runPipeline(pipelineId);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

