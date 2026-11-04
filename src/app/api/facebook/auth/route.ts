import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { facebookService } from '@/lib/services/facebookService';
import { connectMongo } from '@/lib/db';
import { Setting } from '@/models/Setting';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const redirectUri = searchParams.get('redirectUri') || undefined;
    const scopes = searchParams.get('scopes') || undefined;

    const state = crypto.randomBytes(32).toString('hex');
    const result = await facebookService.getAuthUrl(redirectUri, state, scopes);

    const res = NextResponse.json({
      success: true,
      authUrl: result.authUrl,
      configured: result.configured,
      appId: result.appId,
      redirectUri: result.redirectUri,
      message: result.message,
    });

    res.cookies.set('fb_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 900,
      path: '/',
    });

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const appId = body.appId;
    const appSecret = body.appSecret;
    const redirectUri = body.redirectUri;

    await connectMongo();
    let setting = await Setting.findOne();
    if (!setting) {
      setting = new Setting({
        googleDrive: { connected: false },
        defaults: {
          reframeMode: 'blur',
          qualityPreset: 'balanced',
          fontFamily: 'Noto Sans',
          filenameTemplate: '{title}_part{nn}',
        },
        limits: { maxUploadSizeMb: 2048, maxParts: 10000, concurrency: 2 },
      });
    }

    if (!setting.facebook) {
      setting.facebook = { appId: '', appSecret: '', redirectUri: '' };
    }

    if (appId !== undefined) setting.facebook.appId = appId.trim();
    if (appSecret !== undefined) setting.facebook.appSecret = appSecret.trim();
    if (redirectUri !== undefined) setting.facebook.redirectUri = redirectUri.trim();

    await setting.save();
    logger.system('info', 'FACEBOOK_CREDENTIALS_SAVED', 'Updated Facebook credentials in settings');

    return NextResponse.json({
      success: true,
      message: 'Facebook configuration saved successfully.',
      facebook: {
        appId: setting.facebook.appId,
        hasSecret: !!setting.facebook.appSecret,
        redirectUri: setting.facebook.redirectUri,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

