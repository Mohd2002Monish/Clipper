import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { OmniPipeline } from '@/models/OmniPipeline';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectMongo();
    const pipelineId = params.id;
    const body = await req.json();

    const pipeline = await OmniPipeline.findById(pipelineId);
    if (!pipeline) {
      return NextResponse.json({ success: false, error: 'Pipeline not found.' }, { status: 404 });
    }

    if (body.status) {
      pipeline.status = body.status;
    }
    if (body.name) {
      pipeline.name = body.name;
    }
    if (body.targets) {
      pipeline.targets = { ...pipeline.targets, ...body.targets };
    }
    if (body.captions) {
      pipeline.captions = { ...pipeline.captions, ...body.captions };
    }
    if (body.thumbnails) {
      pipeline.thumbnails = { ...pipeline.thumbnails, ...body.thumbnails };
    }
    if (body.schedule) {
      pipeline.schedule = { ...pipeline.schedule, ...body.schedule };
    }

    await pipeline.save();

    return NextResponse.json({
      success: true,
      message: 'Pipeline updated successfully.',
      pipeline,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectMongo();
    const pipelineId = params.id;

    await OmniPipeline.findByIdAndDelete(pipelineId);

    return NextResponse.json({
      success: true,
      message: 'Pipeline deleted successfully.',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

