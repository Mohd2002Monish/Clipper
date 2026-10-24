import { connectMongo } from '../db';
import { ThreadsPost } from '../../models/ThreadsPost';
import { threadsService } from './threadsService';
import { logger } from '../logger/logger';

export class ThreadsAutomationService {
  /**
   * Scans for scheduled posts that are due for release and publishes them.
   */
  public async runScheduledPublishCycle(): Promise<{ published: number; failed: number; skipped: number }> {
    await connectMongo();
    const now = new Date();

    const duePosts = await ThreadsPost.find({
      status: 'scheduled',
      scheduleAt: { $lte: now },
    }).sort({ scheduleAt: 1 });

    let publishedCount = 0;
    let failedCount = 0;

    for (const post of duePosts) {
      try {
        logger.system('info', 'THREADS_SCHEDULER_DISPATCH', `Dispatching scheduled thread ${post._id} for @${post.username}`);
        const res = await threadsService.publishPost(post._id.toString());
        if (res.success) {
          publishedCount++;
        } else {
          failedCount++;
        }
      } catch (err) {
        failedCount++;
        logger.system('error', 'THREADS_SCHEDULER_ERROR', `Failed scheduled post ${post._id}: ${err}`);
      }
    }

    return {
      published: publishedCount,
      failed: failedCount,
      skipped: 0,
    };
  }

  /**
   * Periodically updates metrics for recently published posts.
   */
  public async syncRecentMetrics(): Promise<number> {
    await connectMongo();
    const recentPosts = await ThreadsPost.find({ status: 'published' })
      .sort({ publishedAt: -1 })
      .limit(20);

    let synced = 0;
    for (const post of recentPosts) {
      await threadsService.syncPostMetrics(post._id.toString());
      synced++;
    }
    return synced;
  }
}

export const threadsAutomationService = new ThreadsAutomationService();
