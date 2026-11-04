import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { ClipQueue } from '@/models/ClipQueue';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectMongo();
    const item = await ClipQueue.findById(params.id);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Queue item not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, item });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    await connectMongo();

    const updateFields: Record<string, any> = {};

    if (body.status) updateFields.status = body.status;
    if (body.contentMeta) updateFields.contentMeta = body.contentMeta;
    if (body.downloadDetails) updateFields.downloadDetails = body.downloadDetails;
    if (body.driveDetails) updateFields.driveDetails = body.driveDetails;
    if (body.executionMeta) updateFields.executionMeta = body.executionMeta;

    const updated = await ClipQueue.findByIdAndUpdate(
      params.id,
      { $set: updateFields },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Queue item not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectMongo();
    const deleted = await ClipQueue.findByIdAndDelete(params.id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Queue item not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Queue item removed.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

