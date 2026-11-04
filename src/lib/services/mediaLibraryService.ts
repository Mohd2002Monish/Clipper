import fs from 'fs';
import path from 'path';
import { connectMongo } from '../db';
import { Part, IPartDocument } from '../../models/Part';
import { Job, IJobDocument } from '../../models/Job';
import { YouTubeUpload } from '../../models/YouTubeUpload';
import { InstagramPost } from '../../models/InstagramPost';
import { ThreadsPost } from '../../models/ThreadsPost';
import { FacebookPost } from '../../models/FacebookPost';
import { config } from '../config';

export interface MediaAssetItem {
  id: string;
  filename: string;
  title: string;
  sourceType: 'rendered_split' | 'raw_upload' | 'drive';
  localPath: string;
  publicUrl?: string;
  sizeBytes: number;
  duration?: number;
  dimensions?: { width: number; height: number };
  createdAt: Date;
  folderName: string;
  jobId?: string;
  partIndex?: number;
  topText?: string;
  bottomText?: string;
  syndication: {
    youtube: { posted: boolean; permalink?: string };
    instagram: { posted: boolean; permalink?: string };
    threads: { posted: boolean; permalink?: string };
    facebook: { posted: boolean; permalink?: string };
  };
}

export class MediaLibraryService {
  /**
   * Scans and aggregates all media assets across renders, uploads, and MongoDB records.
   */
  public async getMediaLibrary(filters: {
    folderName?: string;
    sourceType?: string;
    syndicationFilter?: string; // 'all' | 'unposted' | 'posted_any'
    search?: string;
  } = {}): Promise<{
    assets: MediaAssetItem[];
    total: number;
    metrics: {
      totalAssets: number;
      renderedSplits: number;
      rawUploads: number;
      unpostedCount: number;
      totalDiskBytes: number;
    };
  }> {
    await connectMongo();

    // 1. Fetch all rendered parts
    const parts = await Part.find({ status: { $in: ['rendered', 'uploaded'] } })
      .sort({ createdAt: -1 })
      .limit(100);

    // 2. Fetch jobs to map folderName and title
    const jobIds = Array.from(new Set(parts.map((p) => p.jobId)));
    const jobs = await Job.find({ _id: { $in: jobIds } });
    const jobMap = new Map<string, IJobDocument>();
    jobs.forEach((j) => jobMap.set(j._id.toString(), j));

    // 3. Fetch syndication records across all 4 platforms
    const [ytPosts, igPosts, thPosts, fbPosts] = await Promise.all([
      YouTubeUpload.find({ status: 'completed' }),
      InstagramPost.find({ status: 'published' }),
      ThreadsPost.find({ status: 'published' }),
      FacebookPost.find({ status: 'published' }),
    ]);

    // Build lookup sets for quick syndication matching by filename or partId
    const ytSet = new Map<string, string>();
    ytPosts.forEach((p) => {
      if (p.partFilename) ytSet.set(p.partFilename, p.youtubeUrl || '');
    });

    const igSet = new Map<string, string>();
    igPosts.forEach((p) => {
      const fn = p.videoSource?.filename;
      if (fn) igSet.set(fn, p.instagramPermalink || '');
    });

    const thSet = new Map<string, string>();
    thPosts.forEach((p) => {
      const fn = p.videoSource?.filename;
      if (fn) thSet.set(fn, p.threadsPermalink || '');
    });

    const fbSet = new Map<string, string>();
    fbPosts.forEach((p) => {
      const fn = p.videoSource?.filename;
      if (fn) fbSet.set(fn, p.facebookPermalink || '');
    });

    const assets: MediaAssetItem[] = [];
    let totalDiskBytes = 0;
    let renderedCount = 0;
    let rawCount = 0;
    let unpostedCount = 0;

    // Process rendered parts
    for (const part of parts) {
      const job = jobMap.get(part.jobId);
      const filename = part.filename;
      const sizeBytes = part.outputSize || 0;
      totalDiskBytes += sizeBytes;
      renderedCount++;

      const isYt = ytSet.has(filename);
      const isIg = igSet.has(filename);
      const isTh = thSet.has(filename);
      const isFb = fbSet.has(filename);
      const isUnposted = !isYt && !isIg && !isTh && !isFb;

      if (isUnposted) unpostedCount++;

      const publicUrl = `/api/media/stream?file=${encodeURIComponent(part.localPath || filename)}`;

      assets.push({
        id: part._id.toString(),
        filename,
        title: job?.source?.originalName ? `${job.source.originalName} - Part ${part.index}` : filename,
        sourceType: 'rendered_split',
        localPath: part.localPath || '',
        publicUrl,
        sizeBytes,
        duration: part.duration,
        dimensions: part.outputProbe
          ? { width: part.outputProbe.width || 1080, height: part.outputProbe.height || 1920 }
          : undefined,
        createdAt: (part as any).createdAt || new Date(),
        folderName: job?.folderName || 'General',
        jobId: part.jobId,
        partIndex: part.index,
        topText: part.topText,
        bottomText: part.bottomText,
        syndication: {
          youtube: { posted: isYt, permalink: ytSet.get(filename) },
          instagram: { posted: isIg, permalink: igSet.get(filename) },
          threads: { posted: isTh, permalink: thSet.get(filename) },
          facebook: { posted: isFb, permalink: fbSet.get(filename) },
        },
      });
    }

    // Apply Filters
    let filtered = assets;
    if (filters.folderName && filters.folderName !== 'all') {
      filtered = filtered.filter((a) => a.folderName === filters.folderName);
    }
    if (filters.sourceType && filters.sourceType !== 'all') {
      filtered = filtered.filter((a) => a.sourceType === filters.sourceType);
    }
    if (filters.syndicationFilter === 'unposted') {
      filtered = filtered.filter(
        (a) => !a.syndication.youtube.posted && !a.syndication.instagram.posted && !a.syndication.threads.posted && !a.syndication.facebook.posted
      );
    } else if (filters.syndicationFilter === 'posted_any') {
      filtered = filtered.filter(
        (a) => a.syndication.youtube.posted || a.syndication.instagram.posted || a.syndication.threads.posted || a.syndication.facebook.posted
      );
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(
        (a) => a.filename.toLowerCase().includes(q) || a.title.toLowerCase().includes(q)
      );
    }

    return {
      assets: filtered,
      total: filtered.length,
      metrics: {
        totalAssets: assets.length,
        renderedSplits: renderedCount,
        rawUploads: rawCount,
        unpostedCount,
        totalDiskBytes,
      },
    };
  }

  /**
   * Deletes a media file from disk and database.
   */
  public async deleteAsset(assetId: string): Promise<boolean> {
    await connectMongo();
    const part = await Part.findById(assetId);
    if (part) {
      if (part.localPath && fs.existsSync(part.localPath)) {
        try {
          fs.unlinkSync(part.localPath);
        } catch {
          // Ignore
        }
      }
      await Part.findByIdAndDelete(assetId);
      return true;
    }
    return false;
  }
}

export const mediaLibraryService = new MediaLibraryService();
