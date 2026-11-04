import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Part } from '../../models/Part';
import { config } from '../config';
import { logger } from '../logger/logger';
import { probeService } from './probeService';

const execFileAsync = promisify(execFile);

export class PublicMediaService {
  /**
   * Resolves a local video file path on disk from given URL and metadata.
   */
  public async resolveLocalFilePath(params: {
    mediaUrl?: string;
    filename?: string;
    jobId?: string;
    partIndex?: number;
  }): Promise<string | null> {
    const { mediaUrl = '', filename, jobId, partIndex } = params;

    // 1. If mediaUrl is an absolute path on disk
    if (mediaUrl && fs.existsSync(mediaUrl)) {
      try {
        if (fs.statSync(mediaUrl).isFile()) return mediaUrl;
      } catch {
        // ignore
      }
    }

    // 2. If mediaUrl contains /api/video/{filename}
    if (mediaUrl.includes('/api/video/')) {
      const parsedFilename = mediaUrl.split('/api/video/')[1]?.split('?')[0];
      if (parsedFilename) {
        const candidate = path.join(config.uploadsDir, parsedFilename);
        if (fs.existsSync(candidate)) return candidate;
      }
    }

    // 3. If mediaUrl is localhost or 127.0.0.1 pointing to an uploaded file
    if (mediaUrl.includes('localhost') || mediaUrl.includes('127.0.0.1')) {
      const segments = mediaUrl.split('/');
      const lastSegment = segments[segments.length - 1]?.split('?')[0];
      if (lastSegment) {
        const candidate = path.join(config.uploadsDir, lastSegment);
        if (fs.existsSync(candidate)) return candidate;
      }
    }

    // 4. Check by filename in config.uploadsDir
    if (filename) {
      const cleanName = path.basename(filename);
      const candidate = path.join(config.uploadsDir, cleanName);
      if (fs.existsSync(candidate)) return candidate;

      if (fs.existsSync(config.uploadsDir)) {
        try {
          const files = fs.readdirSync(config.uploadsDir);
          const matches = files.filter(
            (f) => f === cleanName || f.endsWith(`_${cleanName}`) || f.includes(cleanName)
          );
          if (matches.length > 0) {
            // Sort by file modification time descending to select newest upload
            matches.sort((a, b) => {
              try {
                const statA = fs.statSync(path.join(config.uploadsDir, a));
                const statB = fs.statSync(path.join(config.uploadsDir, b));
                return statB.mtimeMs - statA.mtimeMs;
              } catch {
                return 0;
              }
            });
            return path.join(config.uploadsDir, matches[0]);
          }
        } catch {
          // ignore
        }
      }
    }

    // 5. If Studio split part URL: /api/download/{jobId}/{partIndex}
    const downloadMatch = mediaUrl.match(/\/api\/download\/([^\/]+)\/(\d+)/);
    if (downloadMatch) {
      const [_, matchJobId, pIdx] = downloadMatch;
      const part = await Part.findOne({ jobId: matchJobId, index: parseInt(pIdx, 10) }).lean();
      if (part?.localPath && fs.existsSync(part.localPath)) {
        return part.localPath;
      }
    }

    // 6. If jobId and partIndex are provided directly
    if (jobId && partIndex !== undefined) {
      const part = await Part.findOne({ jobId, index: partIndex }).lean();
      if (part?.localPath && fs.existsSync(part.localPath)) {
        return part.localPath;
      }
    }

    return null;
  }

  /**
   * Automatically inspects and optimizes video files for Meta Instagram Reels, Threads, and Facebook.
   * Transcodes non-H.264 (e.g. HEVC/AV1), downsizes 4K UHD to 1080p, compresses excessive bitrates,
   * and guarantees the FastStart (+faststart) moov atom is placed at the beginning for instant crawler ingestion.
   */
  public async ensureCompliantVideo(filePath: string): Promise<string> {
    if (!fs.existsSync(filePath)) return filePath;
    const ext = path.extname(filePath).toLowerCase();
    const stat = fs.statSync(filePath);

    let probe: any = null;
    try {
      probe = await probeService.probeVideo(filePath);
    } catch {
      return filePath;
    }

    const videoStream = probe.streams?.find((s: any) => s.codec_type === 'video');
    const codec = (videoStream?.codec_name || '').toLowerCase();
    const width = videoStream?.width || 0;
    const height = videoStream?.height || 0;
    const isHevcOrNonH264 = codec !== 'h264';
    const is4KOrOver1080p = width > 1080 || height > 1920;
    const isOversized = stat.size > 25 * 1024 * 1024; // > 25MB

    // If already compliant (H.264, <= 1080p, <= 25MB), use directly
    if (!isHevcOrNonH264 && !is4KOrOver1080p && !isOversized && ext === '.mp4') {
      return filePath;
    }

    const cleanBase = path.basename(filePath, ext).replace(/^optimized_/, '');
    const optimizedFilename = `optimized_${cleanBase}.mp4`;
    const outputPath = path.join(config.uploadsDir, optimizedFilename);

    // If optimized version already exists and has size, reuse it
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 100000) {
      logger.system(
        'info',
        'PUBLIC_MEDIA_OPTIMIZE_CACHE_HIT',
        `Reusing existing optimized video: ${optimizedFilename}`
      );
      return outputPath;
    }

    logger.system(
      'info',
      'PUBLIC_MEDIA_OPTIMIZE_START',
      `Optimizing video (${codec}, ${width}x${height}, ${(stat.size / (1024 * 1024)).toFixed(1)} MB) for Meta Reels standards...`
    );

    try {
      const ffmpegArgs = [
        '-y',
        '-i', filePath,
        '-vf', "scale='min(1080,iw)':-2",
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '24',
        '-maxrate', '5M',
        '-bufsize', '8M',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputPath,
      ];

      await execFileAsync(config.ffmpegPath, ffmpegArgs, { timeout: 180000 });
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        const newSizeMb = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(1);
        logger.system(
          'info',
          'PUBLIC_MEDIA_OPTIMIZE_SUCCESS',
          `Successfully optimized video to ${optimizedFilename} (${newSizeMb} MB, H.264, FastStart).`
        );
        return outputPath;
      }
    } catch (optErr) {
      logger.system('warn', 'PUBLIC_MEDIA_OPTIMIZE_FAILED', `Optimization failed: ${optErr}, using original file.`);
    }

    return filePath;
  }

  /**
   * Ensures that Meta API (Instagram / Threads) receives a publicly reachable HTTPS video URL.
   * Priority:
   * 1. Already public HTTPS URL
   * 2. PUBLIC_URL / NEXT_PUBLIC_APP_URL configured in environment
   * 3. Local active ngrok tunnel (auto-detected via 127.0.0.1:4040/api/tunnels)
   * 4. Primary Cloud Relay: Uguu.se (supports up to 128MB with byte-range headers)
   * 5. Secondary Cloud Relay: tmpfiles.org
   * 6. Secondary Cloud Relay: catbox.moe
   */
  public async ensurePublicVideoUrl(mediaUrl: string, localFilePath: string | null): Promise<string> {
    const rawUrl = mediaUrl.trim();

    // If no mediaUrl and no localFilePath
    if (!rawUrl && !localFilePath) {
      throw new Error('A video file or URL is required to publish.');
    }

    // 1. If already a valid public HTTPS URL (not localhost / 127.0.0.1)
    if (
      rawUrl.startsWith('https://') &&
      !rawUrl.includes('localhost') &&
      !rawUrl.includes('127.0.0.1')
    ) {
      return rawUrl;
    }

    // Resolve and optimize local video if present
    let effectiveFilePath = localFilePath;
    if (effectiveFilePath && fs.existsSync(effectiveFilePath)) {
      try {
        effectiveFilePath = await this.ensureCompliantVideo(effectiveFilePath);
      } catch (optErr) {
        logger.system('warn', 'PUBLIC_MEDIA_OPTIMIZE_WARN', `Pre-flight optimization skipped: ${optErr}`);
      }
    }

    // 2. Check configured PUBLIC_URL in config / process.env
    const configuredPublicUrl = (
      config.publicUrl ||
      process.env.PUBLIC_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      ''
    ).trim();

    if (configuredPublicUrl && configuredPublicUrl.startsWith('https://')) {
      const publicBase = configuredPublicUrl.replace(/\/+$/, '');
      if (rawUrl.includes('/api/video/')) {
        const streamPath = rawUrl.substring(rawUrl.indexOf('/api/video/'));
        return `${publicBase}${streamPath}`;
      }
      if (rawUrl.includes('/api/download/')) {
        const streamPath = rawUrl.substring(rawUrl.indexOf('/api/download/'));
        return `${publicBase}${streamPath}`;
      }
      if (effectiveFilePath) {
        const filename = path.basename(effectiveFilePath);
        return `${publicBase}/api/video/${filename}`;
      }
    }

    // 3. Auto-detect active local ngrok tunnel via local inspection API
    try {
      const ngrokRes = await fetch('http://127.0.0.1:4040/api/tunnels', {
        signal: AbortSignal.timeout(1200),
      });
      if (ngrokRes.ok) {
        const ngrokData = await ngrokRes.json();
        const httpsTunnel = ngrokData.tunnels?.find((t: any) =>
          t.public_url?.startsWith('https://')
        );
        if (httpsTunnel?.public_url) {
          const publicBase = httpsTunnel.public_url.replace(/\/+$/, '');
          logger.system('info', 'PUBLIC_MEDIA_NGROK_DETECTED', `Auto-detected active ngrok tunnel: ${publicBase}`);
          if (rawUrl.includes('/api/video/')) {
            const streamPath = rawUrl.substring(rawUrl.indexOf('/api/video/'));
            return `${publicBase}${streamPath}`;
          }
          if (rawUrl.includes('/api/download/')) {
            const streamPath = rawUrl.substring(rawUrl.indexOf('/api/download/'));
            return `${publicBase}${streamPath}`;
          }
          if (effectiveFilePath) {
            const filename = path.basename(effectiveFilePath);
            return `${publicBase}/api/video/${filename}`;
          }
        }
      }
    } catch {
      // ngrok local inspection API not responding, proceed to cloud relay
    }

    // If no local file path could be resolved and URL is local, fail gracefully
    if (!effectiveFilePath || !fs.existsSync(effectiveFilePath)) {
      if (!rawUrl || rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1')) {
        throw new Error(
          'Meta cannot fetch media from localhost or an empty URL. Please select a valid video file or run "ngrok http 3000".'
        );
      }
      return rawUrl;
    }

    const filename = path.basename(effectiveFilePath);
    const fileStats = fs.statSync(effectiveFilePath);
    const fileSizeMb = (fileStats.size / (1024 * 1024)).toFixed(1);

    logger.system(
      'info',
      'PUBLIC_MEDIA_RELAY_START',
      `Publishing local file (${fileSizeMb} MB: ${filename}) through public cloud relay for Meta video crawler.`
    );

    const fileBuffer = fs.readFileSync(effectiveFilePath);

    // 4. Primary Cloud Relay: uguu.se
    try {
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: 'video/mp4' });
      formData.append('files[]', blob, filename);

      const res = await fetch('https://uguu.se/upload', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(180000), // 3 min timeout for ~100MB+ files
      });

      const resText = await res.text();
      let resJson: any = null;
      try {
        resJson = JSON.parse(resText);
      } catch {
        // Not valid JSON
      }

      if (res.ok && resJson?.success && Array.isArray(resJson.files) && resJson.files[0]?.url) {
        const publicUrl = resJson.files[0].url;
        logger.system(
          'info',
          'PUBLIC_MEDIA_RELAY_UGUU_SUCCESS',
          `Generated public video relay URL via uguu.se: ${publicUrl}`
        );
        return publicUrl;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.system('warn', 'PUBLIC_MEDIA_RELAY_UGUU_FAILED', `uguu.se upload failed: ${msg}`);
    }

    // 5. Secondary Cloud Relay: catbox.moe
    try {
      const formData = new FormData();
      formData.append('reqtype', 'fileupload');
      const blob = new Blob([fileBuffer], { type: 'video/mp4' });
      formData.append('fileToUpload', blob, filename);

      const res = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(180000),
      });

      const resText = (await res.text()).trim();
      if (res.ok && resText.startsWith('https://')) {
        logger.system(
          'info',
          'PUBLIC_MEDIA_RELAY_CATBOX_SUCCESS',
          `Generated public video relay URL via catbox.moe: ${resText}`
        );
        return resText;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.system('warn', 'PUBLIC_MEDIA_RELAY_CATBOX_FAILED', `catbox.moe upload failed: ${msg}`);
    }

    // 6. Secondary Cloud Relay: tmpfiles.org
    try {
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: 'video/mp4' });
      formData.append('file', blob, filename);

      const res = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(120000),
      });

      const resText = await res.text();
      let resJson: any = null;
      try {
        resJson = JSON.parse(resText);
      } catch {
        // Safe parse
      }

      if (res.ok && resJson?.data?.url) {
        const directUrl = resJson.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
        logger.system(
          'info',
          'PUBLIC_MEDIA_RELAY_TMPFILES_SUCCESS',
          `Generated public video relay URL via tmpfiles.org: ${directUrl}`
        );
        return directUrl;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.system('warn', 'PUBLIC_MEDIA_RELAY_TMPFILES_FAILED', `tmpfiles.org upload failed: ${msg}`);
    }

    // 7. Exhaustive failure with clear instructions
    throw new Error(
      `Unable to establish a public HTTPS link for local video "${filename}" (${fileSizeMb} MB). ` +
      `Meta Instagram/Threads requires an accessible public HTTPS URL. ` +
      `To publish local videos directly without cloud upload limits, run "ngrok http https://localhost:3000" in your terminal or set PUBLIC_URL in your .env file.`
    );
  }
}

export const publicMediaService = new PublicMediaService();

