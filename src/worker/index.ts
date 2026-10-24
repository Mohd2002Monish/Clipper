import 'dotenv/config';
import { Worker, Job as BullJob } from 'bullmq';
import { VIDEO_RENDER_QUEUE_NAME } from '../lib/queue';
import { getRedisClient } from '../lib/redis';
import { connectMongo } from '../lib/db';
import { config } from '../lib/config';
import { logger } from '../lib/logger/logger';
import { checkFfmpegBinary, checkFfprobeBinary } from '../lib/system';
import { orchestrator } from './orchestrator';

interface JobData {
  jobId: string;
}

async function startWorker() {
  logger.system('info', 'WORKER_STARTING', `Starting VideoTimmer worker (concurrency: ${config.workerConcurrency})...`);

  // 1. Verify binaries
  const [ffmpegRes, ffprobeRes] = await Promise.all([
    checkFfmpegBinary(),
    checkFfprobeBinary(),
  ]);

  if (!ffmpegRes.available) {
    logger.system('warn', 'FFMPEG_MISSING', `Worker started without FFmpeg detected: ${ffmpegRes.error}`);
  } else {
    logger.system('info', 'FFMPEG_DETECTED', `FFmpeg available: ${ffmpegRes.version}`);
  }

  if (!ffprobeRes.available) {
    logger.system('warn', 'FFPROBE_MISSING', `Worker started without FFprobe detected: ${ffprobeRes.error}`);
  } else {
    logger.system('info', 'FFPROBE_DETECTED', `FFprobe available: ${ffprobeRes.version}`);
  }

  // 2. Connect to MongoDB
  try {
    await connectMongo();
    logger.system('info', 'WORKER_DB_CONNECTED', 'Worker connected to MongoDB successfully.');
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.system('error', 'WORKER_DB_ERROR', `Worker failed to connect to MongoDB: ${errorMsg}`);
  }

  // 3. Run Crash & Restart Recovery
  try {
    const recoveredCount = await orchestrator.recoverStuckJobs();
    if (recoveredCount > 0) {
      console.log(`[RESTART_RECOVERY] Restored ${recoveredCount} interrupted jobs into the queue.`);
    }
  } catch (recErr) {
    // Ignore if first boot
  }

  const connection = getRedisClient();

  // 4. Initialize BullMQ Worker Consumer
  const worker = new Worker<JobData>(
    VIDEO_RENDER_QUEUE_NAME,
    async (job: BullJob<JobData>) => {
      return await orchestrator.processJob(job);
    },
    {
      connection,
      concurrency: config.workerConcurrency,
    }
  );

  worker.on('ready', () => {
    logger.system('info', 'WORKER_READY', `Worker is ready and listening on queue "${VIDEO_RENDER_QUEUE_NAME}"`);
    console.log(`[WORKER_READY] VideoTimmer Worker is active and listening on "${VIDEO_RENDER_QUEUE_NAME}" (concurrency: ${config.workerConcurrency})`);
  });

  worker.on('active', (job) => {
    logger.queue('info', 'JOB_ACTIVE', `Job ${job.data.jobId} is now active`, job.data.jobId);
  });

  worker.on('completed', (job) => {
    logger.queue('info', 'JOB_COMPLETED', `Job ${job.data.jobId} completed successfully`, job.data.jobId);
  });

  worker.on('failed', (job, err) => {
    logger.queue('error', 'JOB_FAILED', `Job ${job?.data.jobId} failed: ${err.message}`, job?.data.jobId, {
      stack: err.stack,
    });
  });

  worker.on('error', (err) => {
    logger.system('error', 'WORKER_ERROR', `Worker encountered an internal error: ${err.message}`, {
      stack: err.stack,
    });
  });

  // 5. YouTube Auto-Pilot Campaign Hourly Scheduler
  const runYouTubeScheduler = async () => {
    try {
      const { youtubeAutomationService } = await import('../lib/services/youtubeAutomationService');
      await youtubeAutomationService.runHourlyUploadCycle();

      // Daily analytics sync check
      const currentHour = new Date().getHours();
      if (currentHour === 4) {
        await youtubeAutomationService.runDailyAnalyticsSync();
      }
    } catch (schedErr) {
      console.error('[YOUTUBE_SCHEDULER_ERROR]', schedErr);
    }
  };

  setTimeout(runYouTubeScheduler, 30000); // Initial check after 30 seconds
  const schedulerInterval = setInterval(runYouTubeScheduler, 15 * 60 * 1000); // Check every 15 minutes

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.system('info', 'WORKER_SHUTTING_DOWN', `Received ${signal}. Gracefully stopping worker...`);
    clearInterval(schedulerInterval);
    await worker.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startWorker().catch((err) => {
  logger.system('error', 'WORKER_FATAL', `Worker fatal startup error: ${err.message}`, { err });
  process.exit(1);
});
