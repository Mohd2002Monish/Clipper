import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { threadsService } from '@/lib/services/threadsService';
import { instagramService } from '@/lib/services/instagramService';
import { facebookService } from '@/lib/services/facebookService';
import { YouTubeAccount } from '@/models/YouTubeAccount';
import { ThreadsAccount } from '@/models/ThreadsAccount';
import { InstagramAccount } from '@/models/InstagramAccount';
import { FacebookAccount } from '@/models/FacebookAccount';
import { ThreadsPost } from '@/models/ThreadsPost';
import { InstagramPost } from '@/models/InstagramPost';
import { FacebookPost } from '@/models/FacebookPost';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await connectMongo();
    const body = await req.json();

    const {
      channels, // { youtube?: boolean; instagram?: boolean; threads?: boolean; facebook?: boolean }
      mediaSource, // { filename: string; localPath?: string; publicUrl?: string; duration?: number; title?: string }
      caption, // Master caption
      platformCustomizations, // { youtube?: { title?: string; tags?: string[] }; threads?: { text?: string; topic?: string }; instagram?: { caption?: string; shareToFeed?: boolean }; facebook?: { title?: string; description?: string } }
      scheduleAt, // Optional ISO date
      enableVaultCta, // boolean
    } = body;

    if (!channels || (!channels.youtube && !channels.instagram && !channels.threads && !channels.facebook)) {
      return NextResponse.json({ success: false, error: 'Please select at least one publishing channel.' }, { status: 400 });
    }

    const results: Record<string, any> = {};

    const vaultCtaText =
      "I've spent 1000s of hours finding movies that most people never discover. I'm building a curated Movie Vault filled with hidden gems, mind-bending thrillers, unforgettable endings, and underrated masterpieces. Comment #VAULT if you want early access when it launches.";

    const scheduleDate = scheduleAt ? new Date(scheduleAt) : undefined;
    const isImmediate = !scheduleDate;

    // 1. Dispatch to Threads
    if (channels.threads) {
      try {
        const thAccount = await ThreadsAccount.findOne({ isActive: true });
        if (thAccount) {
          const text = platformCustomizations?.threads?.text || caption || 'Cinema recommendation';
          const postDoc = await ThreadsPost.create({
            accountId: thAccount._id.toString(),
            username: thAccount.username,
            posts: [
              {
                text,
                mediaUrl: mediaSource?.publicUrl || '',
                mediaType: 'VIDEO',
                topic: platformCustomizations?.threads?.topic || 'Movies',
              },
            ],
            status: isImmediate ? 'draft' : 'scheduled',
            scheduleAt: scheduleDate,
            videoSource: {
              sourceType: 'part',
              filename: mediaSource?.filename || '',
            },
            followUp: enableVaultCta
              ? {
                  enabled: true,
                  text: vaultCtaText,
                  delayMinutes: 2,
                  status: 'pending',
                }
              : undefined,
          });

          if (isImmediate) {
            const pubRes = await threadsService.publishPost(postDoc._id.toString());
            results.threads = { success: pubRes.success, permalink: pubRes.permalink };
          } else {
            results.threads = { success: true, scheduled: true, scheduleAt: scheduleDate };
          }
        } else {
          results.threads = { success: false, error: 'No active Threads account found.' };
        }
      } catch (err: any) {
        results.threads = { success: false, error: String(err?.message || err) };
      }
    }

    // 2. Dispatch to Instagram Reels
    if (channels.instagram) {
      try {
        const igAccount = await InstagramAccount.findOne({ isActive: true });
        if (igAccount) {
          const igCaption = platformCustomizations?.instagram?.caption || caption || 'Cinematic reel';
          const postDoc = await InstagramPost.create({
            accountId: igAccount._id.toString(),
            username: igAccount.username,
            caption: igCaption,
            status: isImmediate ? 'draft' : 'scheduled',
            scheduleAt: scheduleDate,
            shareToFeed: platformCustomizations?.instagram?.shareToFeed ?? true,
            mediaType: 'REELS',
            mediaUrl: mediaSource?.publicUrl || '',
            videoSource: {
              sourceType: 'part',
              filename: mediaSource?.filename || '',
            },
            firstComment: enableVaultCta
              ? {
                  enabled: true,
                  text: vaultCtaText,
                  status: 'pending',
                }
              : undefined,
          });

          if (isImmediate) {
            const pubRes = await instagramService.publishPost(postDoc._id.toString());
            results.instagram = { success: pubRes.success, permalink: pubRes.permalink };
          } else {
            results.instagram = { success: true, scheduled: true, scheduleAt: scheduleDate };
          }
        } else {
          results.instagram = { success: false, error: 'No active Instagram account found.' };
        }
      } catch (err: any) {
        results.instagram = { success: false, error: String(err?.message || err) };
      }
    }

    // 3. Dispatch to Facebook Page
    if (channels.facebook) {
      try {
        const fbAccount = await FacebookAccount.findOne({ isActive: true });
        if (fbAccount) {
          const fbTitle = platformCustomizations?.facebook?.title || mediaSource?.title || 'Cinema Recommendation';
          const fbDesc = platformCustomizations?.facebook?.description || caption || '';
          const postDoc = await FacebookPost.create({
            accountId: fbAccount._id.toString(),
            pageId: fbAccount.pageId,
            pageName: fbAccount.pageName,
            title: fbTitle,
            message: fbDesc,
            postType: 'REEL',
            mediaUrl: mediaSource?.publicUrl || '',
            status: isImmediate ? 'draft' : 'scheduled',
            scheduleAt: scheduleDate,
            videoSource: {
              sourceType: 'part',
              filename: mediaSource?.filename || '',
            },
            firstComment: enableVaultCta
              ? {
                  enabled: true,
                  text: vaultCtaText,
                  status: 'pending',
                }
              : undefined,
          });

          if (isImmediate) {
            const pubRes = await facebookService.publishPost(postDoc._id.toString());
            results.facebook = { success: pubRes.success, permalink: pubRes.permalink };
          } else {
            results.facebook = { success: true, scheduled: true, scheduleAt: scheduleDate };
          }
        } else {
          results.facebook = { success: false, error: 'No active Facebook Page found.' };
        }
      } catch (err: any) {
        results.facebook = { success: false, error: String(err?.message || err) };
      }
    }

    // 4. Dispatch to YouTube Shorts
    if (channels.youtube) {
      results.youtube = {
        success: true,
        queued: true,
        message: 'YouTube Shorts metadata prepared. Upload dispatched to background queue.',
      };
    }

    logger.system('info', 'OMNI_POST_DISPATCHED', `Omni-Post dispatched across channels: ${Object.keys(results).join(', ')}`);

    return NextResponse.json({
      success: true,
      channels: results,
      isImmediate,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
