import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { FacebookPost } from '@/models/FacebookPost';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectMongo();
    const post = await FacebookPost.findById(params.id);
    if (!post) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, post });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectMongo();
    const res = await FacebookPost.findByIdAndDelete(params.id);
    return NextResponse.json({ success: !!res });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectMongo();
    const body = await req.json();
    const updated = await FacebookPost.findByIdAndUpdate(
      params.id,
      { $set: body },
      { new: true }
    );
    return NextResponse.json({ success: true, post: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

