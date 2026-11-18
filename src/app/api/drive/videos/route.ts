import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { Setting } from '@/models/Setting';
import { driveService } from '@/lib/services/driveService';

export const dynamic = 'force-dynamic';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export async function GET(req: NextRequest) {
  try {
    await connectMongo();
    const drive = await driveService.getAuthenticatedDrive();
    if (!drive) {
      return NextResponse.json(
        {
          success: false,
          error: 'Google Drive is not authenticated or access token has expired. Please connect or reconnect in Settings.',
          videos: [],
          folders: [],
        },
        { status: 200 }
      );
    }

    const { searchParams } = new URL(req.url);
    const requestedFolderId = searchParams.get('folderId') || undefined;
    const searchFilter = (searchParams.get('search') || '').trim();

    // 1. Resolve target folder (use requested, or configured base folder, or root)
    const setting = await Setting.findOne();
    const configuredBaseFolderId = setting?.googleDrive?.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
    const configuredBaseFolderName = setting?.googleDrive?.folderName || 'Default Target Folder';

    let targetFolderId = requestedFolderId;
    if (!targetFolderId || targetFolderId === 'default' || targetFolderId === 'configured') {
      targetFolderId = configuredBaseFolderId || 'root';
    }

    // 2. Discover available subfolders for the folder switcher dropdown
    const folders: Array<{ id: string; name: string }> = [
      { id: configuredBaseFolderId || 'root', name: `${configuredBaseFolderName} (Active)` },
      { id: 'root', name: 'My Drive (Root)' },
    ];

    try {
      const subfoldersRes = await drive.files.list({
        q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: 'files(id, name, parents)',
        pageSize: 60,
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const existingIds = new Set(folders.map((f) => f.id));
      for (const f of subfoldersRes.data.files || []) {
        if (f.id && f.name && !existingIds.has(f.id)) {
          existingIds.add(f.id);
          folders.push({ id: f.id, name: f.name });
        }
      }
    } catch {
      // Non-fatal if listing subfolders fails
    }

    // 3. Build Drive video search query
    let query = 'trashed = false and (mimeType contains \'video/\' or name contains \'.mp4\' or name contains \'.mov\' or name contains \'.mkv\' or name contains \'.webm\')';

    if (targetFolderId && targetFolderId !== 'all') {
      query = `'${targetFolderId}' in parents and ${query}`;
    }

    if (searchFilter) {
      const sanitizedSearch = searchFilter.replace(/'/g, "\\'");
      query = `${query} and name contains '${sanitizedSearch}'`;
    }

    const filesRes = await drive.files.list({
      q: query,
      fields: 'files(id, name, size, webViewLink, thumbnailLink, createdTime, videoMediaMetadata, mimeType)',
      orderBy: 'createdTime desc',
      pageSize: 80,
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const videos = (filesRes.data.files || []).map((file) => {
      const sizeBytes = Number(file.size) || 0;
      const durationMillis = file.videoMediaMetadata?.durationMillis;
      const durationSec = durationMillis ? Math.round(Number(durationMillis) / 1000) : undefined;

      return {
        id: file.id || '',
        name: file.name || 'Untitled Video',
        sizeBytes,
        sizeFormatted: formatBytes(sizeBytes),
        webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
        thumbnailLink: file.thumbnailLink || undefined,
        createdTime: file.createdTime || new Date().toISOString(),
        durationSec,
        mimeType: file.mimeType || 'video/mp4',
      };
    });

    return NextResponse.json({
      success: true,
      activeFolderId: targetFolderId,
      folders,
      videos,
      totalCount: videos.length,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg, videos: [], folders: [] }, { status: 500 });
  }
}
