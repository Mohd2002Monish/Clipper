import { NextRequest, NextResponse } from 'next/server';
import { youtubeService } from '@/lib/services/youtubeService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      channelId,
      folderName,
      sourceType,
      localPath,
      driveFileId,
      title,
      description,
      tags,
      privacyStatus,
      videoType,
      isMadeForKids,
      jobId,
      partIndex,
      partFilename,
    } = body;

    if (!channelId) {
      return NextResponse.json({ error: 'channelId is required. Please select a YouTube channel.' }, { status: 400 });
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Video title is required.' }, { status: 400 });
    }

    if (!localPath && !driveFileId) {
      return NextResponse.json(
        { error: 'Either localPath or driveFileId must be provided to stream the video file.' },
        { status: 400 }
      );
    }

    const uploadResult = await youtubeService.uploadVideo({
      channelId,
      folderName: folderName || 'General',
      sourceType: sourceType || (driveFileId ? 'drive' : 'local'),
      localPath,
      driveFileId,
      title: title.trim(),
      description: description || '',
      tags: Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      privacyStatus: privacyStatus || 'private',
      videoType: videoType === 'long_form' ? 'long_form' : 'short',
      isMadeForKids: Boolean(isMadeForKids),
      jobId,
      partIndex,
      partFilename,
    });

    return NextResponse.json({
      success: true,
      message: 'Video successfully uploaded to YouTube!',
      upload: uploadResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
