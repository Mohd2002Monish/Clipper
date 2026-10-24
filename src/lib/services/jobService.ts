import path from 'path';
import fs from 'fs';
import { connectMongo } from '../db';
import { Job, IJobDocument } from '../../models/Job';
import { Part, IPartDocument } from '../../models/Part';
import { Folder } from '../../models/Folder';
import { enqueueVideoJob } from '../queue';
import { plannerService } from './plannerService';
import { probeService } from './probeService';
import { OutputFormatSettings, SplitSettings, TextOverlaySettings, AISubtitleSettings } from '../../shared/schemas';
import { logger } from '../logger/logger';
import { config } from '../config';

export interface CreateJobInput {
  sourceStoredPath: string;
  originalFilename: string;
  folderName?: string;
  outputFormat: OutputFormatSettings;
  splitSettings: SplitSettings;
  textOverlay: TextOverlaySettings;
  aiSubtitles?: AISubtitleSettings;
}

export class JobService {
  /**
   * Create a new video processing job and enqueue into BullMQ
   */
  public async createJob(input: CreateJobInput): Promise<{ job: IJobDocument; parts: IPartDocument[] }> {
    await connectMongo();

    const { sourceStoredPath, originalFilename, folderName, outputFormat, splitSettings, textOverlay, aiSubtitles } = input;
    const assignedFolder = (folderName || outputFormat.folderName || 'General').trim() || 'General';

    if (!fs.existsSync(sourceStoredPath)) {
      throw new Error(`Source video not found on disk at: ${sourceStoredPath}`);
    }

    const stat = fs.statSync(sourceStoredPath);

    // 1. Probe video facts
    const probe = await probeService.probeVideo(sourceStoredPath);

    // 2. Compute Part Plan
    const planResult = plannerService.computePlan({
      sourceDuration: probe.duration,
      originalFilename,
      splitSettings,
      filenameTemplate: outputFormat.filenameTemplate,
    });

    if (planResult.plan.length === 0) {
      throw new Error('Split plan produced 0 parts.');
    }

    // 3. Create MongoDB Job Document
    const jobDoc = new Job({
      status: 'queued',
      folderName: assignedFolder,
      createdAt: new Date().toISOString(),
      source: {
        originalName: originalFilename,
        sanitizedName: path.basename(sourceStoredPath),
        storedPath: sourceStoredPath,
        sizeBytes: stat.size,
        probe,
      },
      settings: {
        outputFormat: {
          ...outputFormat,
          folderName: assignedFolder,
        },
        splitSettings,
        textOverlay,
        aiSubtitles,
      },
      plan: planResult.plan,
      counts: {
        total: planResult.plan.length,
        rendered: 0,
        uploaded: 0,
        failed: 0,
      },
      cancelRequested: false,
    });

    const savedJob = await jobDoc.save();
    const jobId = String(savedJob._id);

    // Ensure Folder is tracked in MongoDB and increment jobCount
    try {
      await Folder.findOneAndUpdate(
        { name: assignedFolder },
        {
          $setOnInsert: {
            name: assignedFolder,
            slug: assignedFolder.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, ''),
            color: '#2196F3',
            description: '',
          },
          $inc: { jobCount: 1 },
        },
        { upsert: true }
      );
    } catch {
      // Non-fatal if folder counter index conflicts
    }

    // 4. Create MongoDB Part Documents for each segment
    const partDocs: IPartDocument[] = [];
    for (const p of planResult.plan) {
      const partDoc = new Part({
        jobId,
        index: p.index,
        start: p.start,
        end: p.end,
        duration: p.duration,
        filename: p.filename,
        status: 'queued',
        renderProgress: 0,
        uploadProgress: 0,
        renderAttempts: 0,
        uploadAttempts: 0,
      });
      const savedPart = await partDoc.save();
      partDocs.push(savedPart);
    }

    // 5. Enqueue into BullMQ
    try {
      await enqueueVideoJob(jobId);
      logger.queue('info', 'JOB_ENQUEUED', `Job ${jobId} successfully enqueued (${planResult.plan.length} parts)`, jobId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.queue('error', 'JOB_ENQUEUE_FAILED', `Failed to push job ${jobId} to Redis queue: ${msg}`, jobId);
      // Even if Redis is temporarily unreachable, job remains in MongoDB in 'queued' status for recovery
    }

    return { job: savedJob, parts: partDocs };
  }

  /**
   * Get single job by ID with all associated parts
   */
  public async getJob(jobId: string): Promise<{ job: IJobDocument; parts: IPartDocument[] } | null> {
    await connectMongo();
    const job = await Job.findById(jobId);
    if (!job) return null;

    const parts = await Part.find({ jobId }).sort({ index: 1 });
    return { job, parts };
  }

  /**
   * List all jobs with pagination and folder filtering
   */
  public async listJobs(params: { page?: number; limit?: number; status?: string; folder?: string }) {
    await connectMongo();
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(50, params.limit || 10));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (params.status && params.status !== 'all') {
      query.status = params.status;
    }
    if (params.folder && params.folder !== 'all') {
      query.folderName = params.folder;
    }

    const [jobs, total] = await Promise.all([
      Job.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Job.countDocuments(query),
    ]);

    return {
      jobs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Request cancellation of a job mid-render
   */
  public async cancelJob(jobId: string): Promise<boolean> {
    await connectMongo();
    const job = await Job.findById(jobId);
    if (!job) return false;

    job.cancelRequested = true;
    job.status = 'cancelled';
    job.finishedAt = new Date().toISOString();
    await job.save();

    // Mark all queued or rendering parts as cancelled
    await Part.updateMany(
      { jobId, status: { $in: ['queued', 'rendering'] } },
      { $set: { status: 'cancelled' } }
    );

    // Clean up temporary work files
    const workDir = path.join(config.workDir, jobId);
    if (fs.existsSync(workDir)) {
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    }

    logger.queue('warn', 'JOB_CANCELLED_BY_USER', `Job ${jobId} cancelled. Remaining parts marked cancelled.`, jobId);
    return true;
  }

  /**
   * Retry all failed parts for a job without re-rendering successful ones
   */
  public async retryFailedParts(jobId: string): Promise<{ retriedCount: number }> {
    await connectMongo();
    const job = await Job.findById(jobId);
    if (!job) throw new Error('Job not found.');

    const failedParts = await Part.find({ jobId, status: 'failed' });
    if (failedParts.length === 0) {
      return { retriedCount: 0 };
    }

    // Reset failed parts to queued
    for (const p of failedParts) {
      p.status = 'queued';
      p.renderProgress = 0;
      p.lastError = undefined;
      await p.save();
    }

    // Update job status
    job.cancelRequested = false;
    job.status = 'queued';
    job.counts.failed = 0;
    await job.save();

    // Re-enqueue
    await enqueueVideoJob(jobId);
    logger.queue('info', 'FAILED_PARTS_REQUEUED', `Re-enqueued ${failedParts.length} failed parts for job ${jobId}`, jobId);

    return { retriedCount: failedParts.length };
  }

  /**
   * Retry a single part by index
   */
  public async retrySinglePart(jobId: string, partIndex: number): Promise<boolean> {
    await connectMongo();
    const part = await Part.findOne({ jobId, index: partIndex });
    if (!part) return false;

    part.status = 'queued';
    part.renderProgress = 0;
    part.lastError = undefined;
    await part.save();

    const job = await Job.findById(jobId);
    if (job) {
      job.cancelRequested = false;
      job.status = 'queued';
      await job.save();
      await enqueueVideoJob(jobId);
    }

    return true;
  }

  /**
   * Delete job, parts, and associated output files
   */
  public async deleteJob(jobId: string): Promise<boolean> {
    await connectMongo();
    const job = await Job.findById(jobId);
    if (job?.folderName) {
      try {
        await Folder.findOneAndUpdate(
          { name: job.folderName, jobCount: { $gt: 0 } },
          { $inc: { jobCount: -1 } }
        );
      } catch {}
      const safeFolder = job.folderName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'General';
      const folderOutDir = path.join(config.outputsDir, safeFolder, jobId);
      if (fs.existsSync(folderOutDir)) fs.rmSync(folderOutDir, { recursive: true, force: true });
    }

    await Job.findByIdAndDelete(jobId);
    await Part.deleteMany({ jobId });

    // Delete temporary work and legacy output folders
    const workDir = path.join(config.workDir, jobId);
    const legacyOutDir = path.join(config.outputsDir, jobId);

    if (fs.existsSync(workDir)) fs.rmSync(workDir, { recursive: true, force: true });
    if (fs.existsSync(legacyOutDir)) fs.rmSync(legacyOutDir, { recursive: true, force: true });

    logger.cleanup('info', 'JOB_DELETED', `Deleted job ${jobId} and all associated files`, { jobId });
    return true;
  }
}

export const jobService = new JobService();
