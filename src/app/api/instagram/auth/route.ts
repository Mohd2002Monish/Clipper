import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { instagramService } from '@/lib/services/instagramService';
import { connectMongo } from '@/lib/db';
import { Setting } from '@/models/Setting';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const redirectUri = searchParams.get('redirectUri') || undefined;

    // Generate cryptographically secure state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    const result = await instagramService.getAuthUrl(redirectUri, state);

    const res = NextResponse.json({
      success: true,
      authUrl: result.authUrl,
      configured: result.configured,
      appId: result.appId,
      clientId: result.clientId,
      redirectUri: result.redirectUri,
      message: result.message,
    });

    // Store state in a secure, HTTP-only cookie
    res.cookies.set('ig_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 900, // 15 mins
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
    const appId = body.clientId || body.appId;
    const appSecret = body.clientSecret || body.appSecret;
    const redirectUri = body.redirectUri;

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
    logger.system('info', 'INSTAGRAM_OAUTH_CONFIG_SAVED', 'Direct Instagram Login credentials saved to system configuration');

    const result = await instagramService.getAuthUrl(setting.instagram.redirectUri);

    return NextResponse.json({
      success: true,
      message: 'Direct Instagram Login configuration updated successfully',
      configured: result.configured,
      authUrl: result.authUrl,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
