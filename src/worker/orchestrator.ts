import { Job as BullJob } from 'bullmq';
import { connectMongo } from '../lib/db';
import { Job, IJobDocument } from '../models/Job';
import { Part, IPartDocument } from '../models/Part';
import { partRenderer } from '../lib/renderer/renderPart';
import { enqueueVideoJob } from '../lib/queue';
import { logger } from '../lib/logger/logger';
import { driveService } from '../lib/services/driveService';
import { geminiSubtitleService } from '../lib/services/geminiSubtitleService';
import path from 'path';
import fs from 'fs';
import { config } from '../lib/config';
import { Setting } from '../models/Setting';

export class PipelineOrchestrator {
  /**
   * Main processing pipeline for a single BullMQ job
   */
  public async processJob(bullJob: BullJob<{ jobId: string }>): Promise<{ success: boolean; jobId: string }> {
    await connectMongo();
    const { jobId } = bullJob.data;

    logger.queue('info', 'JOB_PROCESSING_START', `Worker orchestrator picked up job ${jobId}`, jobId);

    const job = await Job.findById(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found in database.`);
    }

    if (job.cancelRequested || job.status === 'cancelled') {
      logger.queue('warn', 'JOB_CANCELLED_SKIPPED', `Job ${jobId} was already cancelled, skipping.`, jobId);
      return { success: false, jobId };
    }

    // Set status to processing
    job.status = 'processing';
    if (!job.startedAt) {
      job.startedAt = new Date().toISOString();
    }
    await job.save();

    const parts = await Part.find({ jobId }).sort({ index: 1 });
    const totalParts = parts.length;

    let renderedCount = 0;
    let uploadedCount = 0;
    let failedCount = 0;

    let targetDriveFolderId = job.settings.outputFormat.driveFolderId;
    if (job.settings.outputFormat.destination === 'drive') {
      try {
        if (!targetDriveFolderId) {
          const setting = await Setting.findOne();
          targetDriveFolderId = setting?.googleDrive?.folderId || 'root';
        }

        // 1. Ensure the parent/category folder on Google Drive
        const assignedFolder = job.folderName || job.settings.outputFormat.folderName;
        if (assignedFolder && assignedFolder.trim()) {
          targetDriveFolderId = await driveService.ensureSubfolder(targetDriveFolderId, assignedFolder.trim());
        }

        // 2. If createSubfolder is checked, create subfolder for the specific video
        if (job.settings.outputFormat.createSubfolder) {
          const videoFolderName = (job.source?.originalName || 'Video_Parts').replace(/\.[^/.]+$/, '');
          targetDriveFolderId = await driveService.ensureSubfolder(targetDriveFolderId, videoFolderName);
        }
      } catch (err: unknown) {
        logger.drive('warn', 'SUBFOLDER_SETUP_ERROR', `Failed setting up Drive destination subfolder: ${err}`, jobId);
      }
    }

    for (const part of parts) {
      // Re-check cancellation before each part
      const latestJobCheck = await Job.findById(jobId, { cancelRequested: 1, status: 1 });
      if (latestJobCheck?.cancelRequested || latestJobCheck?.status === 'cancelled') {
        logger.queue('warn', 'JOB_ABORTED_MID_RUN', `Job ${jobId} cancelled mid-run. Aborting further parts.`, jobId);
        break;
      }

      // Idempotency: skip if already rendered
      if (part.status === 'rendered' || part.status === 'uploaded') {
        renderedCount++;
        continue;
      }

      // Update part status to rendering
      part.status = 'rendering';
      part.renderProgress = 0;
      part.renderAttempts += 1;
      await Part.updateOne(
        { _id: part._id },
        {
          $set: {
            status: 'rendering',
            renderProgress: 0,
            renderAttempts: part.renderAttempts,
          },
        }
      );

      // Part-by-part AI Subtitles: Extract and transcribe ONLY this part's audio slice with Gemini AI
      let partSrtPath: string | undefined = undefined;
      const aiSubsConfig = job.settings.aiSubtitles || (job.settings as any).textOverlay?.aiSubtitles;
      if (aiSubsConfig?.enabled) {
        try {
          const jobWorkDir = path.join(config.workDir, jobId);
          fs.mkdirSync(jobWorkDir, { recursive: true });
          const srtPath = path.join(jobWorkDir, `part_${part.index}_subtitles.srt`);

          // 1. If subtitles already pre-generated in Step 4 wizard, slice for this part
          if (aiSubsConfig.subtitles && aiSubsConfig.subtitles.length > 0) {
            const hasSubs = geminiSubtitleService.generatePartSrt(
              aiSubsConfig.subtitles,
              part.start,
              part.start + part.duration,
              srtPath
            );
            if (hasSubs) {
              partSrtPath = srtPath;
              logger.render(
                'info',
                'PART_SUBTITLE_SLICED',
                `Applied ${aiSubsConfig.subtitles.length} global subtitle cues to Part ${part.index}`,
                jobId,
                part.index
              );
            }
          }

          // 2. If no pre-generated subtitles exist, transcribe this part's audio slice with Gemini AI on demand
          if (!partSrtPath) {
            logger.render(
              'info',
              'PART_SUBTITLE_TRANSCRIBE_START',
              `Transcribing audio for Part ${part.index}/${totalParts} (${part.start}s - ${part.start + part.duration}s) with Gemini AI...`,
              jobId,
              part.index
            );

            const partSubs = await geminiSubtitleService.generateSubtitles(
              job.source.storedPath,
              undefined,
              part.start,
              part.duration
            );

            if (partSubs && partSubs.length > 0) {
              geminiSubtitleService.writeSrtFile(partSubs, srtPath);
              partSrtPath = srtPath;
              logger.render(
                'info',
                'PART_SUBTITLE_TRANSCRIBE_COMPLETE',
                `Generated ${partSubs.length} subtitle cues for Part ${part.index}`,
                jobId,
                part.index
              );
            } else {
              logger.render(
                'warn',
                'PART_SUBTITLE_NO_CUES',
                `No speech cues returned by Gemini AI for Part ${part.index}`,
                jobId,
                part.index
              );
            }
          }
        } catch (subErr: unknown) {
          const msg = subErr instanceof Error ? subErr.message : String(subErr);
          logger.render(
            'warn',
            'PART_SUBTITLE_TRANSCRIBE_FAILED',
            `Subtitle generation failed for Part ${part.index}, proceeding with render: ${msg}`,
            jobId,
            part.index
          );
        }
      }

      try {
        let lastRenderProgress = -1;
        let lastRenderSaveTime = 0;

        const renderResult = await partRenderer.renderSinglePart({
          jobId,
          partIndex: part.index,
          totalParts,
          start: part.start,
          duration: part.duration,
          outputFilename: part.filename,
          sourceFilePath: job.source.storedPath,
          sourceProbe: job.source.probe || ({} as any),
          outputFormat: job.settings.outputFormat,
          textOverlay: job.settings.textOverlay,
          aiSubtitles: aiSubsConfig,
          partSrtPath,
          onProgress: async (percent) => {
            part.renderProgress = percent;
            const now = Date.now();
            // Throttled update: only update DB if percent changed by >= 3% or if 1s has elapsed, or at 100%
            if (percent === 100 || Math.abs(percent - lastRenderProgress) >= 3 || now - lastRenderSaveTime >= 1000) {
              lastRenderProgress = percent;
              lastRenderSaveTime = now;
              try {
                await Part.updateOne({ _id: part._id }, { $set: { renderProgress: percent } });
                const overallProgress = Math.round(((renderedCount + percent / 100) / totalParts) * 100);
                await bullJob.updateProgress(overallProgress);
              } catch {
                // Ignore transient update collisions
              }
            }
          },
        });

        // Mark part as rendered
        part.status = 'rendered';
        part.renderProgress = 100;
        part.localPath = renderResult.outputPath;
        part.outputSize = renderResult.outputSize;
        part.outputProbe = renderResult.verification.probe;
        await Part.updateOne(
          { _id: part._id },
          {
            $set: {
              status: 'rendered',
              renderProgress: 100,
              localPath: renderResult.outputPath,
              outputSize: renderResult.outputSize,
              outputProbe: renderResult.verification.probe,
            },
          }
        );

        renderedCount++;
        job.counts.rendered = renderedCount;
        await job.save();

        // If destination is Google Drive, execute upload step
        if (job.settings.outputFormat.destination === 'drive' && targetDriveFolderId) {
          part.status = 'uploading';
          part.uploadProgress = 0;
          part.uploadAttempts += 1;
          await Part.updateOne(
            { _id: part._id },
            {
              $set: {
                status: 'uploading',
                uploadProgress: 0,
                uploadAttempts: part.uploadAttempts,
              },
            }
          );

          try {
            let lastUploadProgress = -1;
            let lastUploadSaveTime = 0;

            const uploadRes = await driveService.uploadFile({
              filePath: renderResult.outputPath,
              filename: part.filename,
              folderId: targetDriveFolderId,
              onConflict: job.settings.outputFormat.onConflict || 'rename',
              jobId,
              partIndex: part.index,
              onProgress: async (percent) => {
                part.uploadProgress = percent;
                const now = Date.now();
                if (percent === 100 || Math.abs(percent - lastUploadProgress) >= 3 || now - lastUploadSaveTime >= 1000) {
                  lastUploadProgress = percent;
                  lastUploadSaveTime = now;
                  try {
                    await Part.updateOne({ _id: part._id }, { $set: { uploadProgress: percent } });
                  } catch {
                    // Ignore transient update collisions
                  }
                }
              },
            });

            part.status = 'uploaded';
            part.uploadProgress = 100;
            part.driveFileId = uploadRes.fileId;
            part.driveLink = uploadRes.webViewLink;
            part.driveChecksum = uploadRes.checksum;
            await Part.updateOne(
              { _id: part._id },
              {
                $set: {
                  status: 'uploaded',
                  uploadProgress: 100,
                  driveFileId: uploadRes.fileId,
                  driveLink: uploadRes.webViewLink,
                  driveChecksum: uploadRes.checksum,
                },
              }
            );

            uploadedCount++;
            job.counts.uploaded = uploadedCount;
            await job.save();

            // ZERO-STORAGE OPTIMIZATION:
            // Since the rendered part is safely in Google Drive, immediately delete the local MP4
            // so local hard drive storage is never consumed or bloated!
            if (renderResult?.outputPath && fs.existsSync(renderResult.outputPath)) {
              try {
                fs.unlinkSync(renderResult.outputPath);
                logger.drive(
                  'info',
                  'PART_LOCAL_PURGED',
                  `Purged local rendered copy for Part ${part.index} after successful Google Drive upload to conserve local storage.`,
                  jobId,
                  part.index
                );
              } catch {
                // Non-blocking cleanup
              }
            }
          } catch (upErr: unknown) {
            const upErrMsg = upErr instanceof Error ? upErr.message : String(upErr);
            logger.drive('error', 'PART_DRIVE_UPLOAD_FAILED', `Drive upload failed for part ${part.index}: ${upErrMsg}`, jobId, part.index);
            part.status = 'failed';
            part.lastError = `Drive upload failed: ${upErrMsg}`;
            await Part.updateOne(
              { _id: part._id },
              {
                $set: {
                  status: 'failed',
                  lastError: `Drive upload failed: ${upErrMsg}`,
                },
              }
            );

            failedCount++;
            job.counts.failed = failedCount;
            await job.save();
          }
        }
      } catch (partErr: unknown) {
        const errorMsg = partErr instanceof Error ? partErr.message : String(partErr);
        logger.render('error', 'PART_RENDER_FAILED', `Part ${part.index} failed: ${errorMsg}`, jobId, part.index);

        part.status = 'failed';
        part.lastError = errorMsg;
        await Part.updateOne(
          { _id: part._id },
          {
            $set: {
              status: 'failed',
              lastError: errorMsg,
            },
          }
        );

        failedCount++;
        job.counts.failed = failedCount;
        await job.save();
      } finally {
        if (partSrtPath && fs.existsSync(partSrtPath)) {
          try {
            fs.unlinkSync(partSrtPath);
          } catch {}
        }
      }
    }

    // Finalize Job Status
    const finalJob = await Job.findById(jobId);
    if (!finalJob) return { success: false, jobId };

    const isDriveDest = job.settings.outputFormat.destination === 'drive';
    const isAllSuccessful = isDriveDest
      ? uploadedCount === totalParts
      : renderedCount === totalParts;

    if (finalJob.cancelRequested) {
      finalJob.status = 'cancelled';
    } else if (isAllSuccessful) {
      finalJob.status = 'completed';
    } else if ((renderedCount > 0 || uploadedCount > 0) && failedCount > 0) {
      finalJob.status = 'completed_with_errors';
    } else {
      finalJob.status = 'failed';
      finalJob.error = {
        code: 'ALL_PARTS_FAILED',
        message:
          isDriveDest && renderedCount > 0
            ? 'Video parts rendered but failed to upload to Google Drive.'
            : 'All video parts failed to render.',
      };
    }

    finalJob.finishedAt = new Date().toISOString();
    await finalJob.save();

    logger.queue('info', 'JOB_FINALIZED', `Job ${jobId} finalized with status: ${finalJob.status} (${renderedCount}/${totalParts} rendered, ${failedCount} failed)`, jobId);

    return {
      success: finalJob.status === 'completed' || finalJob.status === 'completed_with_errors',
      jobId,
    };
  }

  /**
   * On worker startup: detects any jobs stuck in 'processing' from an ungraceful shutdown
   * and re-enqueues them to recover automatically without data loss!
   */
  public async recoverStuckJobs(): Promise<number> {
    await connectMongo();

    const stuckJobs = await Job.find({
      status: { $in: ['processing', 'queued'] },
      cancelRequested: false,
    });

    if (stuckJobs.length === 0) return 0;

    logger.system('info', 'RESTART_RECOVERY', `Found ${stuckJobs.length} stuck jobs to recover after restart.`);

    for (const job of stuckJobs) {
      const jobId = String(job._id);
      // Reset any parts stuck in 'rendering' back to 'queued'
      await Part.updateMany({ jobId, status: 'rendering' }, { $set: { status: 'queued', renderProgress: 0 } });

      job.status = 'queued';
      await job.save();

      try {
        await enqueueVideoJob(jobId);
        logger.queue('info', 'JOB_RECOVERED_ENQUEUED', `Re-enqueued stuck job ${jobId} during startup recovery`, jobId);
      } catch (err) {
        // Ignore
      }
    }

    return stuckJobs.length;
  }
}

export const orchestrator = new PipelineOrchestrator();
