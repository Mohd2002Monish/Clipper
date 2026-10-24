import { Queue, QueueEvents } from 'bullmq';
import { getRedisClient } from './redis';
import { logger } from './logger/logger';

export const VIDEO_RENDER_QUEUE_NAME = 'video-render-jobs';

declare global {
  // eslint-disable-next-line no-var
  var videoRenderQueue: Queue | undefined;
  // eslint-disable-next-line no-var
  var videoRenderQueueEvents: QueueEvents | undefined;
}

export function getVideoRenderQueue(): Queue {
  if (!global.videoRenderQueue) {
    const connection = getRedisClient();
    global.videoRenderQueue = new Queue(VIDEO_RENDER_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      },
    });

    logger.queue('info', 'QUEUE_INITIALIZED', `Queue ${VIDEO_RENDER_QUEUE_NAME} initialized`);
  }

  return global.videoRenderQueue;
}

export function getQueueEvents(): QueueEvents {
  if (!global.videoRenderQueueEvents) {
    const connection = getRedisClient();
    global.videoRenderQueueEvents = new QueueEvents(VIDEO_RENDER_QUEUE_NAME, {
      connection,
    });
  }
  return global.videoRenderQueueEvents;
}

export async function enqueueVideoJob(jobId: string, priority: number = 0) {
  const queue = getVideoRenderQueue();
  logger.queue('info', 'JOB_ENQUEUED', `Job ${jobId} pushed to queue`, jobId);
  return await queue.add(
    'process-video',
    { jobId },
    {
      jobId, // Unique ID prevents duplicate jobs
      priority,
    }
  );
}
