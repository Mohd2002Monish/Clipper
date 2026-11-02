import fs from 'fs';
import path from 'path';
import { Part } from '../../models/Part';
import { config } from '../config';
import { logger } from '../logger/logger';

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
      const candidate = path.join(config.uploadsDir, filename);
      if (fs.existsSync(candidate)) return candidate;

      if (fs.existsSync(config.uploadsDir)) {
        try {
          const files = fs.readdirSync(config.uploadsDir);
          const match = files.find(
            (f) => f.includes(filename) || filename.includes(f)
          );
          if (match) return path.join(config.uploadsDir, match);
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

    // 1. If already a valid public HTTPS URL (not localhost / 127.0.0.1)
    if (
      rawUrl.startsWith('https://') &&
      !rawUrl.includes('localhost') &&
      !rawUrl.includes('127.0.0.1')
    ) {
      return rawUrl;
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
      if (localFilePath) {
        const filename = path.basename(localFilePath);
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
          if (localFilePath) {
            const filename = path.basename(localFilePath);
            return `${publicBase}/api/video/${filename}`;
          }
        }
      }
    } catch {
      // ngrok local inspection API not responding, proceed to cloud relay
    }

    // If no local file path could be resolved and URL is local, fail gracefully
    if (!localFilePath || !fs.existsSync(localFilePath)) {
      if (rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1')) {
        throw new Error(
          'Meta cannot fetch media from localhost. Please run "ngrok http https://localhost:3000" or set PUBLIC_URL in .env.'
        );
      }
      return rawUrl;
    }

    const filename = path.basename(localFilePath);
    const fileStats = fs.statSync(localFilePath);
    const fileSizeMb = (fileStats.size / (1024 * 1024)).toFixed(1);

    logger.system(
      'info',
      'PUBLIC_MEDIA_RELAY_START',
      `Publishing local file (${fileSizeMb} MB: ${filename}) through public cloud relay for Meta video crawler.`
    );

    const fileBuffer = fs.readFileSync(localFilePath);

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

