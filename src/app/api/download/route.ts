import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { connectMongo } from '@/lib/db';
import { ClipQueue } from '@/models/ClipQueue';
import { Setting } from '@/models/Setting';
import { driveService } from '@/lib/services/driveService';
import { clipIngestionService } from '@/lib/services/clipIngestionService';
import { IdmLogger } from '@/lib/logger/idmLogger';

export const dynamic = 'force-dynamic';

export interface IdmJob {
  id: string;
  url: string;
  quality: 'best' | '1080p' | '720p' | '480p' | 'audio';
  target: 'local' | 'drive';
  targetFolder: string;
  status: 'starting' | 'downloading' | 'merging' | 'uploading_drive' | 'ready' | 'error';
  progressText: string;
  percent?: number;
  title?: string;
  author?: string;
  filePath?: string;
  fileSizeBytes?: number;
  resolution?: string;
  driveViewLink?: string;
  error?: string;
  startedAt: number;
}

// In-memory active jobs registry attached to globalThis to persist across Next.js dev route re-evaluations
const globalForIdm = globalThis as unknown as {
  activeJobs?: Map<string, IdmJob>;
  activeJobsInterval?: NodeJS.Timeout;
};

const activeJobs =
  globalForIdm.activeJobs || (globalForIdm.activeJobs = new Map<string, IdmJob>());

// Clean up stale jobs older than 1 hour (attach interval once)
if (!globalForIdm.activeJobsInterval) {
  globalForIdm.activeJobsInterval = setInterval(() => {
    const oneHourAgo = Date.now() - 3600000;
    for (const [id, job] of activeJobs.entries()) {
      if (job.startedAt < oneHourAgo) {
        if (job.filePath && fs.existsSync(job.filePath)) {
          try { fs.unlinkSync(job.filePath); } catch {}
        }
        activeJobs.delete(id);
      }
    }
  }, 600000);
}

/**
 * GET /api/download
 * - ?jobId=<id> : Poll job status and progress
 * - ?fileId=<id> : Stream ready downloaded MP4 natively into browser
 * - ?logs=true : Return recent log entries from logs/idm_extension.log
 * - ?url=<url>&direct=true : Legacy direct stream fallback
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // 1. Return recent logs
    if (searchParams.get('logs') === 'true') {
      const logs = IdmLogger.getRecentLogs(100);
      return NextResponse.json({ success: true, count: logs.length, logs }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // 2. Poll active job status
    const jobId = searchParams.get('jobId');
    if (jobId) {
      const job = activeJobs.get(jobId);
      if (!job) {
        return NextResponse.json({ success: false, error: 'Job not found or expired' }, {
          status: 404,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }

      return NextResponse.json({
        success: true,
        jobId: job.id,
        status: job.status,
        progressText: job.progressText,
        percent: job.percent || 0,
        title: job.title || '',
        author: job.author || '',
        resolution: job.resolution || '',
        fileSizeBytes: job.fileSizeBytes || 0,
        driveViewLink: job.driveViewLink,
        error: job.error,
        downloadUrl: job.status === 'ready' && job.target === 'local'
          ? `/api/download?fileId=${job.id}`
          : undefined,
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // 3. Stream completed file to browser
    const fileId = searchParams.get('fileId');
    if (fileId) {
      const job = activeJobs.get(fileId);
      if (!job || !job.filePath || !fs.existsSync(job.filePath)) {
        return NextResponse.json({ success: false, error: 'File is not ready or has expired' }, {
          status: 404,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }

      const filePath = job.filePath;
      const stat = fs.statSync(filePath);
      const ext = job.quality === 'audio' ? 'mp3' : 'mp4';
      const mimeType = job.quality === 'audio' ? 'audio/mpeg' : 'video/mp4';

      const safeTitle = (job.title || 'video')
        .replace(/[/\\?%*:|"<>]/g, '_')
        .substring(0, 100);
      const downloadFilename = `${safeTitle}.${ext}`;

      const nodeStream = fs.createReadStream(filePath);
      const webStream = new ReadableStream({
        start(controller) {
          nodeStream.on('data', (chunk) => controller.enqueue(chunk));
          nodeStream.on('end', () => {
            controller.close();
            // Delete temporary file after browser download completes
            setTimeout(() => {
              try {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                activeJobs.delete(fileId);
              } catch {}
            }, 5000);
          });
          nodeStream.on('error', (err) => {
            controller.error(err);
          });
        },
        cancel() {
          nodeStream.destroy();
        },
      });

      IdmLogger.success('FILE_STREAM_STARTED', `Streaming file "${downloadFilename}" to browser (${(stat.size / (1024 * 1024)).toFixed(1)} MB)`, {
        fileId,
        downloadFilename,
      });

      return new NextResponse(webStream, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(downloadFilename)}"`,
          'Content-Length': String(stat.size),
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 4. Legacy direct stream if URL provided
    const rawUrl = searchParams.get('url');
    if (rawUrl) {
      const result = await clipIngestionService.downloadVideo(rawUrl, 'best');
      const stat = fs.statSync(result.filePath);
      const nodeStream = fs.createReadStream(result.filePath);
      const webStream = new ReadableStream({
        start(controller) {
          nodeStream.on('data', (c) => controller.enqueue(c));
          nodeStream.on('end', () => {
            controller.close();
            try { if (fs.existsSync(result.filePath)) fs.unlinkSync(result.filePath); } catch {}
          });
          nodeStream.on('error', (err) => controller.error(err));
        },
      });

      return new NextResponse(webStream, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(result.title)}.mp4"`,
          'Content-Length': String(stat.size),
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Missing parameter' }, { status: 400 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    IdmLogger.error('GET_ROUTE_ERROR', errorMsg);
    return NextResponse.json({ success: false, error: errorMsg }, {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
}

/**
 * POST /api/download
 * Starts background download job with quality selection and live progress.
 * Body: { url, quality, target: 'local' | 'drive', targetFolder }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      url,
      quality = 'best',
      target = 'local',
      targetFolder = 'Shorts',
      notes = '',
      referer = '',
    } = body;

    if (!url) {
      return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
    }

    const jobId = `idm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const job: IdmJob = {
      id: jobId,
      url,
      quality,
      target,
      targetFolder,
      status: 'starting',
      progressText: 'Initializing download engine...',
      percent: 0,
      startedAt: Date.now(),
    };

    activeJobs.set(jobId, job);

    IdmLogger.info('JOB_CREATED', `Created download job ${jobId} for ${url}`, {
      quality,
      target,
      targetFolder,
      hasReferer: Boolean(referer),
    });

    // Execute download asynchronously in background
    (async () => {
      try {
        job.status = 'downloading';
        job.progressText = 'Contacting video stream...';

        const downloadResult = await clipIngestionService.downloadVideo(
          url,
          quality,
          (progressText, percent) => {
            job.progressText = progressText;
            if (percent !== undefined) {
              job.percent = Math.round(percent);
            }
          },
          referer
        );

        job.title = downloadResult.title;
        job.author = downloadResult.author;
        job.resolution = downloadResult.resolution;
        job.fileSizeBytes = downloadResult.fileSizeBytes;
        job.filePath = downloadResult.filePath;

        // If Target is Drive: Upload to Google Drive
        if (target === 'drive') {
          job.status = 'uploading_drive';
          job.progressText = `Transferring to Google Drive / ${targetFolder}...`;

          await connectMongo();
          const cleanUrl = url.split('?')[0].trim();
          const platform = url.includes('instagram.com')
            ? 'instagram'
            : url.includes('youtube.com') || url.includes('youtu.be')
            ? 'youtube'
            : 'web';

          // Resolve Drive Folder
          let targetFolderId = 'root';
          const setting = await Setting.findOne();
          const baseFolderId = setting?.googleDrive?.folderId;
          if (baseFolderId) {
            targetFolderId = await driveService.ensureSubfolder(baseFolderId, targetFolder);
          }

          const cleanSafeFilename = `${downloadResult.title.replace(/[/\\?%*:|"<>]/g, '_').substring(0, 80)}.mp4`;
          const driveRes = await driveService.uploadFile({
            filePath: downloadResult.filePath,
            filename: cleanSafeFilename,
            folderId: targetFolderId,
          });

          // Delete temp file after Drive upload
          if (fs.existsSync(downloadResult.filePath)) {
            try { fs.unlinkSync(downloadResult.filePath); } catch {}
          }

          // Register in ClipQueue
          await ClipQueue.create({
            url,
            cleanUrl,
            platform,
            status: 'completed',
            targetFolder: {
              folderId: targetFolderId,
              folderName: targetFolder,
            },
            contentMeta: {
              title: downloadResult.title,
              author: downloadResult.author,
              durationSeconds: downloadResult.durationSeconds,
              notes: notes || 'Uploaded via IDM Extension',
            },
            driveDetails: {
              uploadedAt: new Date(),
              fileId: driveRes.fileId,
              fileName: cleanSafeFilename,
              fileSizeBytes: downloadResult.fileSizeBytes,
              mimeType: 'video/mp4',
              webViewLink: driveRes.webViewLink,
            },
          });

          job.status = 'ready';
          job.progressText = 'Saved to Google Drive';
          job.driveViewLink = driveRes.webViewLink;

          IdmLogger.success('DRIVE_STAGED', `Uploaded "${downloadResult.title}" to Drive / ${targetFolder}`, {
            jobId,
            driveViewLink: driveRes.webViewLink,
          });
        } else {
          // Local target is ready for streaming
          job.status = 'ready';
          job.progressText = 'Video ready for browser download';
          job.percent = 100;
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        job.status = 'error';
        job.error = errorMsg;
        job.progressText = `Error: ${errorMsg}`;

        IdmLogger.error('JOB_EXECUTION_ERROR', errorMsg, { jobId, url });
      }
    })();

    // Immediate response to extension (< 50ms)
    return NextResponse.json({
      success: true,
      jobId,
      status: job.status,
      message: 'Download job started in background',
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    IdmLogger.error('POST_ROUTE_ERROR', errorMsg);
    return NextResponse.json({ success: false, error: errorMsg }, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
