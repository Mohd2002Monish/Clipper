import { connectMongo } from '../db';
import { InstagramPost } from '../../models/InstagramPost';
import { instagramService } from './instagramService';
import { logger } from '../logger/logger';

export class InstagramAutomationService {
  /**
   * Scans for scheduled Instagram Reels and posts that are due for release and publishes them.
   */
  public async runScheduledPublishCycle(): Promise<{ published: number; failed: number; skipped: number }> {
    await connectMongo();
    const now = new Date();

    const duePosts = await InstagramPost.find({
      status: 'scheduled',
      scheduleAt: { $lte: now },
    }).sort({ scheduleAt: 1 });

    let publishedCount = 0;
    let failedCount = 0;

    for (const post of duePosts) {
      try {
        logger.system(
          'info',
          'INSTAGRAM_SCHEDULER_DISPATCH',
          `Dispatching scheduled Instagram Reel ${post._id} for @${post.username}`
        );
        const res = await instagramService.publishPost(post._id.toString());
        if (res.success) {
          publishedCount++;
        } else {
          failedCount++;
        }
      } catch (err) {
        failedCount++;
        logger.system('error', 'INSTAGRAM_SCHEDULER_ERROR', `Failed scheduled Instagram Reel ${post._id}: ${err}`);
      }
    }

    return {
      published: publishedCount,
      failed: failedCount,
      skipped: 0,
    };
  }
}

export const instagramAutomationService = new InstagramAutomationService();
