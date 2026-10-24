import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { Job } from '@/models/Job';
import { Part } from '@/models/Part';
import { driveService } from '@/lib/services/driveService';
import { Setting } from '@/models/Setting';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export interface VideoItem {
  id: string;
  name: string;
  title: string;
  duration: number;
  width?: number;
  height?: number;
  aspectRatio: string;
  isShort: boolean;
  sourceType: 'drive' | 'local';
  driveFileId?: string;
  driveLink?: string;
  localPath?: string;
  sizeBytes?: number;
  jobId?: string;
  partIndex?: number;
  folderName: string;
  createdAt: string;
}

export async function GET(req: NextRequest) {
  try {
    await connectMongo();
    const { searchParams } = new URL(req.url);
    const requestedFolder = (searchParams.get('folder') || 'General').trim();
    const isAll = requestedFolder.toLowerCase() === 'all';

    const videos: VideoItem[] = [];
    const seenIds = new Set<string>();
    const seenDriveIds = new Set<string>();

    // 1. Fetch from MongoDB Jobs & Parts with case-insensitive matching
    const escapedReq = requestedFolder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const folderRegex = new RegExp(`^${escapedReq}$`, 'i');

    const jobQuery: Record<string, any> = {};
    if (!isAll) {
      jobQuery.$or = [
        { folderName: { $regex: folderRegex } },
        { 'source.originalName': { $regex: new RegExp(escapedReq, 'i') } },
      ];
    }

    const jobs = await Job.find(jobQuery).sort({ createdAt: -1 }).limit(100).lean();
    const jobIds = jobs.map((j) => String(j._id));
    const jobMap = new Map(jobs.map((j) => [String(j._id), j]));

    if (jobIds.length > 0) {
      // Find parts that are rendered/uploaded OR have a valid localPath or driveFileId
      const parts = await Part.find({
        jobId: { $in: jobIds },
        $or: [
          { status: { $in: ['rendered', 'uploaded', 'completed'] } },
          { driveFileId: { $exists: true, $ne: '' } },
          { localPath: { $exists: true, $ne: '' } },
        ],
      })
        .sort({ jobId: -1, index: 1 })
        .lean();

      for (const part of parts) {
        const parentJob = jobMap.get(part.jobId);
        const folderName = parentJob?.folderName || requestedFolder || 'General';
        const rawTitle = (parentJob?.source?.originalName || 'Video').replace(/\.[^/.]+$/, '');
        const itemTitle = `${rawTitle} - Part ${part.index}`;

        const width = part.outputProbe?.width;
        const height = part.outputProbe?.height;
        let aspectRatio = '16:9';
        let isShort = false;

        if (width && height) {
          const ratio = width / height;
          if (ratio < 0.7) {
            aspectRatio = '9:16';
            isShort = true;
          } else if (ratio >= 0.7 && ratio <= 1.2) {
            aspectRatio = '1:1';
          } else {
            aspectRatio = '16:9';
          }
        }

        if (part.duration && part.duration <= 60) {
          isShort = true;
        }

        const id = String(part._id);
        seenIds.add(id);
        if (part.driveFileId) {
          seenDriveIds.add(part.driveFileId);
        }

        videos.push({
          id,
          name: part.filename || `Part_${part.index}.mp4`,
          title: itemTitle,
          duration: part.duration || 60,
          width,
          height,
          aspectRatio,
          isShort,
          sourceType: part.driveFileId ? 'drive' : 'local',
          driveFileId: part.driveFileId,
          driveLink: part.driveLink,
          localPath: part.localPath,
          sizeBytes: part.outputSize,
          jobId: part.jobId,
          partIndex: part.index,
          folderName,
          createdAt: part.createdAt || new Date().toISOString(),
        });
      }
    }

    // 2. Fetch from Google Drive with recursive subfolder discovery
    try {
      const drive = await driveService.getAuthenticatedDrive();
      if (drive) {
        // Fetch all non-trashed folders from Drive to map parents and subfolders
        const allFoldersRes = await drive.files.list({
          q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
          fields: 'files(id, name, parents)',
          pageSize: 150,
          spaces: 'drive',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });

        const allFolders = allFoldersRes.data.files || [];

        // Identify matched base folder(s) by case-insensitive name
        const normalizedTarget = requestedFolder.toLowerCase().replace(/[^a-z0-9]/g, '');
        const setting = await Setting.findOne();
        const configuredBaseFolderId = setting?.googleDrive?.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
        const targetFolderIds = new Set<string>();

        if (isAll) {
          if (configuredBaseFolderId) {
            targetFolderIds.add(configuredBaseFolderId);
            let addedDescendants = true;
            while (addedDescendants) {
              addedDescendants = false;
              for (const f of allFolders) {
                if (f.id && !targetFolderIds.has(f.id) && f.parents) {
                  if (f.parents.some((p: string) => targetFolderIds.has(p))) {
                    targetFolderIds.add(f.id);
                    addedDescendants = true;
                  }
                }
              }
            }
          }
        } else {
          for (const f of allFolders) {
            if (!f.id || !f.name) continue;
            const normName = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (
              normName === normalizedTarget ||
              normName.includes(normalizedTarget) ||
              normalizedTarget.includes(normName)
            ) {
              targetFolderIds.add(f.id);
            }
          }

          // If no folder found yet by list, check if ensureSubfolder returns one
          if (targetFolderIds.size === 0) {
            const setting = await Setting.findOne();
            const parentId = setting?.googleDrive?.folderId || 'root';
            const ensuredId = await driveService.ensureSubfolder(parentId, requestedFolder.trim());
            if (ensuredId) targetFolderIds.add(ensuredId);
          }

          // RECURSIVE DISCOVERY: Include all child subfolders inside matched folders!
          // (e.g. "Mr. Robot > Mr.Robot.S02E02.1080p... > *.mp4")
          let addedMore = true;
          while (addedMore) {
            addedMore = false;
            for (const f of allFolders) {
              if (f.id && !targetFolderIds.has(f.id) && f.parents) {
                const hasTargetParent = f.parents.some((p: string) => targetFolderIds.has(p));
                if (hasTargetParent) {
                  targetFolderIds.add(f.id);
                  addedMore = true;
                }
              }
            }
          }
        }

        // Now query files in all target folders
        const folderIdsArray = Array.from(targetFolderIds);
        const driveFiles: any[] = [];

        if (folderIdsArray.length > 0) {
          // Batch in chunks of 15 parents to avoid query length limits
          const chunkSize = 15;
          for (let i = 0; i < folderIdsArray.length; i += chunkSize) {
            const chunk = folderIdsArray.slice(i, i + chunkSize);
            const parentFilter = chunk.map((id) => `'${id}' in parents`).join(' or ');
            const q = `trashed = false and (${parentFilter}) and (mimeType contains 'video/' or name contains '.mp4' or name contains '.mkv' or name contains '.mov' or name contains '.webm')`;

            const res = await drive.files.list({
              q,
              fields: 'files(id, name, size, webViewLink, createdTime, videoMediaMetadata, parents)',
              pageSize: 50,
              spaces: 'drive',
              supportsAllDrives: true,
              includeItemsFromAllDrives: true,
            });

            if (res.data.files) {
              driveFiles.push(...res.data.files);
            }
          }
        }

        // Also fallback search files by name in Drive if folderIds didn't match directly
        if (driveFiles.length === 0 && !isAll) {
          const cleanSearch = requestedFolder.replace(/['"]/g, '').trim();
          if (cleanSearch) {
            const fallbackRes = await drive.files.list({
              q: `trashed = false and name contains '${cleanSearch}' and (mimeType contains 'video/' or name contains '.mp4' or name contains '.mkv')`,
              fields: 'files(id, name, size, webViewLink, createdTime, videoMediaMetadata, parents)',
              pageSize: 30,
              spaces: 'drive',
              supportsAllDrives: true,
              includeItemsFromAllDrives: true,
            });
            if (fallbackRes.data.files) {
              driveFiles.push(...fallbackRes.data.files);
            }
          }
        }

        // Process found Drive files
        for (const file of driveFiles) {
          if (!file.id) continue;
          if (seenDriveIds.has(file.id)) {
            // Already tracked via MongoDB part, update missing link if needed
            const existingVid = videos.find((v) => v.driveFileId === file.id);
            if (existingVid && !existingVid.driveLink && file.webViewLink) {
              existingVid.driveLink = file.webViewLink;
            }
            continue;
          }

          seenDriveIds.add(file.id);

          const durationMs = file.videoMediaMetadata?.durationMillis;
          const durationSec = durationMs ? Math.round(Number(durationMs) / 1000) : 60;
          const width = file.videoMediaMetadata?.width;
          const height = file.videoMediaMetadata?.height;
          let aspectRatio = '16:9';
          let isShort = false;

          if (width && height) {
            const ratio = width / height;
            if (ratio < 0.7) {
              aspectRatio = '9:16';
              isShort = true;
            }
          }
          if (durationSec <= 60) {
            isShort = true;
          }

          videos.push({
            id: file.id,
            name: file.name || 'Drive Video',
            title: (file.name || 'Drive Video').replace(/\.[^/.]+$/, ''),
            duration: durationSec,
            width,
            height,
            aspectRatio,
            isShort,
            sourceType: 'drive',
            driveFileId: file.id,
            driveLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
            sizeBytes: file.size ? parseInt(file.size, 10) : undefined,
            folderName: requestedFolder,
            createdAt: file.createdTime || new Date().toISOString(),
          });
        }
      }
    } catch (driveErr) {
      // Non-fatal if Drive query fails
      console.error('[YOUTUBE_VIDEOS_DRIVE_ERROR]', driveErr);
    }

    return NextResponse.json({
      folder: requestedFolder,
      count: videos.length,
      videos,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
