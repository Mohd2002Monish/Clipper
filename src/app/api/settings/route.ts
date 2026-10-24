import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { Setting } from '@/models/Setting';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectMongo();
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({
        googleDrive: { connected: false },
        defaults: {
          reframeMode: 'blur',
          qualityPreset: 'balanced',
          fontFamily: 'Noto Sans',
          filenameTemplate: '{title}_part{nn}',
        },
        limits: {
          maxUploadSizeMb: 2048,
          maxParts: 100,
          concurrency: 2,
        },
      });
    }

    return NextResponse.json({
      success: true,
      settings: {
        googleDrive: {
          connected: Boolean(setting.googleDrive?.connected),
          folderId: setting.googleDrive?.folderId || '',
          folderName: setting.googleDrive?.folderName || '',
          userEmail: setting.googleDrive?.userEmail || '',
          lastTestedAt: setting.googleDrive?.lastTestedAt || '',
          authType: setting.googleDrive?.authType || 'oauth',
        },
        threads: {
          appId: setting.threads?.appId || process.env.THREADS_APP_ID || '',
          appSecret: setting.threads?.appSecret ? '••••••••' : process.env.THREADS_APP_SECRET ? '••••••••' : '',
          hasAppSecret: Boolean(setting.threads?.appSecret || process.env.THREADS_APP_SECRET),
          redirectUri: setting.threads?.redirectUri || process.env.THREADS_REDIRECT_URI || 'http://localhost:3000/auth/threads/callback',
        },
        instagram: {
          appId: setting.instagram?.appId || process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID || '',
          appSecret: setting.instagram?.appSecret ? '••••••••' : process.env.INSTAGRAM_APP_SECRET ? '••••••••' : '',
          hasAppSecret: Boolean(setting.instagram?.appSecret || process.env.INSTAGRAM_APP_SECRET),
          redirectUri: setting.instagram?.redirectUri || process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:3000/auth/instagram/callback',
        },
        defaults: setting.defaults,
        limits: setting.limits,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    await connectMongo();

    let setting = await Setting.findOne();
    if (!setting) {
      setting = new Setting();
    }

    if (body.googleDrive) {
      if (body.googleDrive.folderId !== undefined) {
        setting.googleDrive.folderId = body.googleDrive.folderId;
      }
      if (body.googleDrive.folderName !== undefined) {
        setting.googleDrive.folderName = body.googleDrive.folderName;
      }
    }

    if (body.threads) {
      if (!setting.threads) {
        setting.threads = { appId: '', appSecret: '', redirectUri: 'http://localhost:3000/auth/threads/callback' };
      }
      if (body.threads.appId !== undefined) {
        setting.threads.appId = body.threads.appId.trim();
      }
      if (body.threads.appSecret !== undefined && body.threads.appSecret && !body.threads.appSecret.includes('•••')) {
        setting.threads.appSecret = body.threads.appSecret.trim();
      }
      if (body.threads.redirectUri !== undefined) {
        setting.threads.redirectUri = body.threads.redirectUri.trim();
      }
    }

    if (body.instagram) {
      if (!setting.instagram) {
        setting.instagram = { appId: '', appSecret: '', redirectUri: 'http://localhost:3000/auth/instagram/callback' };
      }
      if (body.instagram.appId !== undefined) {
        setting.instagram.appId = body.instagram.appId.trim();
      }
      if (body.instagram.appSecret !== undefined && body.instagram.appSecret && !body.instagram.appSecret.includes('•••')) {
        setting.instagram.appSecret = body.instagram.appSecret.trim();
      }
      if (body.instagram.redirectUri !== undefined) {
        setting.instagram.redirectUri = body.instagram.redirectUri.trim();
      }
    }

    if (body.defaults) {
      setting.defaults = {
        ...setting.defaults,
        ...body.defaults,
      };
    }

    if (body.limits) {
      setting.limits = {
        ...setting.limits,
        ...body.limits,
      };
    }

    await setting.save();
    logger.system('info', 'SETTINGS_UPDATED', 'System settings updated');

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
        googleDrive: {
          connected: Boolean(setting.googleDrive?.connected),
          folderId: setting.googleDrive?.folderId || '',
          folderName: setting.googleDrive?.folderName || '',
          userEmail: setting.googleDrive?.userEmail || '',
          lastTestedAt: setting.googleDrive?.lastTestedAt || '',
          authType: setting.googleDrive?.authType || 'oauth',
        },
        defaults: setting.defaults,
        limits: setting.limits,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
