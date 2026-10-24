import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { ThreadsPost } from '@/models/ThreadsPost';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectMongo();
    const post = await ThreadsPost.findById(params.id);
    if (!post) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, post });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectMongo();
    const body = await req.json();
    const { posts, scheduleAt, status, autoRepost, followUp } = body;

    const updateData: Record<string, unknown> = {};
    if (posts) updateData.posts = posts;
    if (scheduleAt !== undefined) {
      updateData.scheduleAt = scheduleAt ? new Date(scheduleAt) : null;
      if (scheduleAt) {
        updateData.status = 'scheduled';
      }
    }
    if (status) updateData.status = status;
    if (autoRepost) updateData.autoRepost = autoRepost;
    if (followUp) updateData.followUp = followUp;

    const updated = await ThreadsPost.findByIdAndUpdate(params.id, { $set: updateData }, { new: true });
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, post: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectMongo();
    const deleted = await ThreadsPost.findByIdAndDelete(params.id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Thread removed successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
