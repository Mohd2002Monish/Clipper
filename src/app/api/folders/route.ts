import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { Folder } from '@/models/Folder';
import { Job } from '@/models/Job';
import { Setting } from '@/models/Setting';
import { driveService } from '@/lib/services/driveService';

export const dynamic = 'force-dynamic';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

export async function GET() {
  try {
    await connectMongo();

    // 1. Get configured base target folder from Settings / env
    const setting = await Setting.findOne();
    const baseFolderId = setting?.googleDrive?.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
    const baseFolderName = setting?.googleDrive?.folderName || 'Root Target';

    // 2. Ensure default General folder exists in DB
    const generalExists = await Folder.findOne({ name: 'General' });
    if (!generalExists) {
      await Folder.create({
        name: 'General',
        slug: 'general',
        color: '#2196F3',
        description: 'Default folder',
        parentFolderId: baseFolderId || null,
      });
    }

    // 3. Aggregate job counts per folderName
    const jobCounts = await Job.aggregate([
      { $group: { _id: '$folderName', count: { $sum: 1 } } },
    ]);
    const countsMap = new Map<string, number>();
    for (const item of jobCounts) {
      if (item._id) {
        countsMap.set(item._id, item.count);
      }
    }

    // 4. Discover subfolders that exist ONLY inside the configured base folder
    const validFolderNames = new Set<string>(['General']);
    if (baseFolderName && baseFolderName !== 'Root Target') {
      validFolderNames.add(baseFolderName);
    }

    try {
      const drive = await driveService.getAuthenticatedDrive();
      if (drive && baseFolderId && baseFolderId !== 'root') {
        // Query ONLY folders whose parent is the configured base folder
        const driveFoldersRes = await drive.files.list({
          q: `'${baseFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)',
          pageSize: 100,
          spaces: 'drive',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });

        for (const df of driveFoldersRes.data.files || []) {
          const trimmed = (df.name || '').trim();
          if (trimmed && !trimmed.startsWith('.')) {
            validFolderNames.add(trimmed);
            // Sync or update in DB
            const existingFolder = await Folder.findOne({
              name: { $regex: new RegExp(`^${trimmed}$`, 'i') },
            });
            if (!existingFolder) {
              await Folder.create({
                name: trimmed,
                slug: slugify(trimmed),
                color: '#8B5CF6',
                description: 'Synced from Drive folder',
                driveFolderId: df.id,
                parentFolderId: baseFolderId,
                jobCount: countsMap.get(trimmed) || 0,
              });
            } else if (!existingFolder.driveFolderId || existingFolder.parentFolderId !== baseFolderId) {
              existingFolder.driveFolderId = df.id || undefined;
              existingFolder.parentFolderId = baseFolderId;
              await existingFolder.save();
            }
          }
        }
      }
    } catch {
      // Non-fatal if drive listing fails
    }

    // 5. Fetch registered folders that are within the configured parent or have active jobs
    const allDbFolders: any[] = await Folder.find().sort({ createdAt: 1 }).lean();
    
    // Filter to only include folders that are inside the configured folder, or are active in jobs
    const filteredFolders = allDbFolders.filter((f) => {
      if (f.name === 'General') return true;
      if (validFolderNames.has(f.name)) return true;
      if (baseFolderId && f.parentFolderId === baseFolderId) return true;
      if (countsMap.has(f.name) && (countsMap.get(f.name) || 0) > 0) return true;
      return false;
    });

    const foldersWithCounts = filteredFolders.map((folder) => ({
      ...folder,
      jobCount: countsMap.get(folder.name) || 0,
    }));

    return NextResponse.json({
      success: true,
      configuredBaseFolder: {
        id: baseFolderId || null,
        name: baseFolderName,
      },
      folders: foldersWithCounts,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectMongo();
    const body = await req.json();

    const rawName = (body.name || '').trim();
    if (!rawName) {
      return NextResponse.json(
        { success: false, error: 'Folder name is required' },
        { status: 400 }
      );
    }

    if (rawName.length > 60) {
      return NextResponse.json(
        { success: false, error: 'Folder name cannot exceed 60 characters' },
        { status: 400 }
      );
    }

    // 1. Get configured base folder ID
    const setting = await Setting.findOne();
    const baseFolderId = setting?.googleDrive?.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

    // 2. If Drive is authenticated and baseFolderId exists, ensure subfolder inside base folder
    let createdDriveFolderId: string | undefined;
    try {
      const drive = await driveService.getAuthenticatedDrive();
      if (drive && baseFolderId) {
        createdDriveFolderId = await driveService.ensureSubfolder(baseFolderId, rawName);
      }
    } catch {
      // Non-fatal if offline/auth pending, folder will still exist in DB
    }

    const slug = slugify(rawName) || 'folder';
    const color = body.color || '#2196F3';
    const description = (body.description || '').trim();

    // Case-insensitive check if folder already exists in DB
    let existing = await Folder.findOne({
      name: { $regex: new RegExp(`^${rawName}$`, 'i') },
    });

    if (existing) {
      if (createdDriveFolderId && !existing.driveFolderId) {
        existing.driveFolderId = createdDriveFolderId;
        existing.parentFolderId = baseFolderId || undefined;
        await existing.save();
      }
      return NextResponse.json({
        success: true,
        folder: existing,
        message: 'Folder already exists',
      });
    }

    const folder = await Folder.create({
      name: rawName,
      slug,
      color,
      description,
      driveFolderId: createdDriveFolderId || null,
      parentFolderId: baseFolderId || null,
      jobCount: 0,
    });

    return NextResponse.json({
      success: true,
      folder,
      message: `Folder "${rawName}" created successfully inside configured target`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
