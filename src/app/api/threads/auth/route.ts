import { NextRequest, NextResponse } from 'next/server';
import { threadsService } from '@/lib/services/threadsService';
import { connectMongo } from '@/lib/db';
import { Setting } from '@/models/Setting';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const redirectUri = searchParams.get('redirectUri') || undefined;

    const result = await threadsService.getAuthUrl(redirectUri);
    return NextResponse.json({
      success: true,
      authUrl: result.authUrl,
      configured: result.configured,
      appId: result.appId,
      redirectUri: result.redirectUri,
      message: result.message,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { appId, appSecret, redirectUri } = body;

    await connectMongo();
    let setting = await Setting.findOne();
    if (!setting) {
      setting = new Setting();
    }

    if (!setting.threads) {
      setting.threads = { appId: '', appSecret: '', redirectUri: 'http://localhost:3000/auth/threads/callback' };
    }

    if (appId !== undefined) setting.threads.appId = String(appId).trim();
    if (appSecret !== undefined && !String(appSecret).includes('•••')) {
      setting.threads.appSecret = String(appSecret).trim();
    }
    if (redirectUri !== undefined) setting.threads.redirectUri = String(redirectUri).trim();

    await setting.save();
    logger.system('info', 'THREADS_OAUTH_CONFIG_SAVED', 'Meta Threads OAuth credentials saved to system configuration');

    const result = await threadsService.getAuthUrl(setting.threads.redirectUri);

    return NextResponse.json({
      success: true,
      message: 'Meta Threads OAuth configuration updated successfully',
      configured: result.configured,
      authUrl: result.authUrl,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
