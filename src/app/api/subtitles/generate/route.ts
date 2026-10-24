import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { geminiSubtitleService } from '@/lib/services/geminiSubtitleService';
import { config } from '@/lib/config';
import { logger } from '@/lib/logger/logger';

import { chunkManager } from '@/lib/uploader/chunkManager';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uploadId, sourceFileId, sanitizedFilename, filename, storedPath: providedPath, apiKey, startSec, durationSec } = body;

    // 1. Locate the video file on disk
    let targetVideoPath = providedPath && fs.existsSync(providedPath) ? providedPath : undefined;

    // A. Check if sanitizedFilename was provided directly
    const candidateName = sanitizedFilename || filename;
    if (!targetVideoPath && candidateName) {
      if (fs.existsSync(candidateName)) {
        targetVideoPath = candidateName;
      } else {
        const candidatePath = path.join(config.uploadsDir, candidateName);
        if (fs.existsSync(candidatePath)) {
          targetVideoPath = candidatePath;
        }
      }
    }

    // B. Check upload session metadata
    const idToFind = uploadId || sourceFileId;
    if (!targetVideoPath && idToFind) {
      try {
        const meta = chunkManager.getSession(idToFind);
        if (meta && meta.sanitizedFilename) {
          const sessionFilePath = path.join(config.uploadsDir, meta.sanitizedFilename);
          if (fs.existsSync(sessionFilePath)) {
            targetVideoPath = sessionFilePath;
          }
        }
      } catch {
        // Continue to directory scan
      }
    }

    // C. Scan uploads directory for id, suffix, or partial match
    if (!targetVideoPath && fs.existsSync(config.uploadsDir)) {
      const files = fs.readdirSync(config.uploadsDir).filter((f) => !f.startsWith('.'));
      if (idToFind) {
        const suffix = idToFind.includes('_') ? idToFind.split('_').pop() : idToFind;
        const match = files.find(
          (f) =>
            f === idToFind ||
            f.includes(idToFind) ||
            f.startsWith(idToFind) ||
            (suffix && suffix.length >= 6 && f.includes(suffix))
        );
        if (match) {
          targetVideoPath = path.join(config.uploadsDir, match);
        }
      }

      // D. Fallback: If only 1 video file exists in uploadsDir, use it
      if (!targetVideoPath && files.length === 1) {
        targetVideoPath = path.join(config.uploadsDir, files[0]);
      }
    }

    if (!targetVideoPath || !fs.existsSync(targetVideoPath)) {
      return NextResponse.json(
        { error: 'Video file could not be located on disk. Please upload the video first.' },
        { status: 404 }
      );
    }

    // 2. Check for Gemini API Key
    const effectiveKey =
      apiKey ||
      config.geminiApiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY;

    if (!effectiveKey) {
      return NextResponse.json(
        {
          error:
            'GEMINI_API_KEY is not set. Please add your Gemini API key to the .env file (GEMINI_API_KEY=your_key) or provide it in settings.',
        },
        { status: 400 }
      );
    }

    // 3. Transcribe audio with Gemini AI (optionally for first part or snippet)
    const subtitles = await geminiSubtitleService.generateSubtitles(
      targetVideoPath,
      effectiveKey,
      startSec,
      durationSec
    );

    return NextResponse.json({
      success: true,
      count: subtitles.length,
      subtitles,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('api', 'GEMINI_SUBTITLES_API_ERROR', `Failed generating subtitles: ${errorMsg}`);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
