import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { ThreadsAccount } from '@/models/ThreadsAccount';
import { ThreadsPost } from '@/models/ThreadsPost';
import { InstagramAccount } from '@/models/InstagramAccount';
import { InstagramPost } from '@/models/InstagramPost';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await connectMongo();

    const threadsAccountRes = await ThreadsAccount.deleteMany({
      $or: [{ username: /flimyapper/i }, { isSimulated: true }, { userId: /flimyapper/i }],
    });

    const threadsPostRes = await ThreadsPost.deleteMany({
      $or: [
        { username: /flimyapper/i },
        { accountId: /flimyapper/i },
        { accountId: 'default' },
        { accountId: 'flimyapper_default' },
      ],
    });

    const instagramAccountRes = await InstagramAccount.deleteMany({
      $or: [{ username: /flimyapper/i }, { isSimulated: true }, { instagramUserId: /flimyapper/i }],
    });

    const instagramPostRes = await InstagramPost.deleteMany({
      $or: [
        { username: /flimyapper/i },
        { accountId: /flimyapper/i },
        { accountId: 'default' },
        { accountId: 'ig_flimyapper_default' },
      ],
    });

    return NextResponse.json({
      success: true,
      message: 'All fake accounts and posts purged successfully from MongoDB',
      purged: {
        threadsAccounts: threadsAccountRes.deletedCount,
        threadsPosts: threadsPostRes.deletedCount,
        instagramAccounts: instagramAccountRes.deletedCount,
        instagramPosts: instagramPostRes.deletedCount,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
