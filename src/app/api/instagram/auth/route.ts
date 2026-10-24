import { NextRequest, NextResponse } from 'next/server';
import { instagramService } from '@/lib/services/instagramService';
import { connectMongo } from '@/lib/db';
import { Setting } from '@/models/Setting';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const redirectUri = searchParams.get('redirectUri') || undefined;

    const result = await instagramService.getAuthUrl(redirectUri);
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

    if (!setting.instagram) {
      setting.instagram = { appId: '', appSecret: '', redirectUri: 'http://localhost:3000/auth/instagram/callback' };
    }

    if (appId !== undefined) setting.instagram.appId = String(appId).trim();
    if (appSecret !== undefined && !String(appSecret).includes('•••')) {
      setting.instagram.appSecret = String(appSecret).trim();
    }
    if (redirectUri !== undefined) setting.instagram.redirectUri = String(redirectUri).trim();

    await setting.save();
    logger.system('info', 'INSTAGRAM_OAUTH_CONFIG_SAVED', 'Meta Instagram OAuth credentials saved to system configuration');

    const result = await instagramService.getAuthUrl(setting.instagram.redirectUri);

    return NextResponse.json({
      success: true,
      message: 'Meta Instagram OAuth configuration updated successfully',
      configured: result.configured,
      authUrl: result.authUrl,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
