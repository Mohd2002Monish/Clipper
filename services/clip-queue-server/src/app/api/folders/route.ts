import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { DriveFolderRegistry } from '@/models/DriveFolderRegistry';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectMongo();
    const registry = await DriveFolderRegistry.findOne().sort({ updatedAt: -1 });

    if (registry && registry.folders.length > 0) {
      return NextResponse.json({
        success: true,
        folders: registry.folders,
        lastSyncedAt: registry.lastSyncedAt,
      });
    }

    // Default fallback folders if Mac has not synced yet
    const fallbackFolders = [
      { id: 'default_shorts', name: 'Shorts', parentPath: 'Drive / Shorts' },
      { id: 'default_general', name: 'General', parentPath: 'Drive / General' },
      { id: 'default_gta5', name: 'GTA-5', parentPath: 'Drive / GTA-5' },
      { id: 'default_vault', name: 'Movie-Vault', parentPath: 'Drive / Movie-Vault' },
    ];

    return NextResponse.json({
      success: true,
      folders: fallbackFolders,
      isFallback: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const folders = body.folders;

    if (!Array.isArray(folders)) {
      return NextResponse.json({ success: false, error: 'Folders must be an array.' }, { status: 400 });
    }

    await connectMongo();

    let registry = await DriveFolderRegistry.findOne();
    if (registry) {
      registry.folders = folders.map((f: any) => ({
        id: String(f.id || f.name),
        name: String(f.name),
        parentPath: f.parentPath || '',
        jobCount: f.jobCount || 0,
        updatedAt: new Date(),
      }));
      registry.lastSyncedAt = new Date();
      await registry.save();
    } else {
      registry = await DriveFolderRegistry.create({
        folders: folders.map((f: any) => ({
          id: String(f.id || f.name),
          name: String(f.name),
          parentPath: f.parentPath || '',
          jobCount: f.jobCount || 0,
          updatedAt: new Date(),
        })),
        lastSyncedAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      count: registry.folders.length,
      lastSyncedAt: registry.lastSyncedAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

