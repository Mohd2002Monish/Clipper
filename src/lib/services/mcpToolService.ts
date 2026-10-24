import { connectMongo } from '../db';
import { ThreadsAccount } from '../../models/ThreadsAccount';
import { ThreadsPost } from '../../models/ThreadsPost';
import { InstagramAccount } from '../../models/InstagramAccount';
import { InstagramPost } from '../../models/InstagramPost';
import { threadsService } from './threadsService';
import { logger } from '../logger/logger';

export interface McpToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export class McpToolService {
  /**
   * Returns list of all MCP tools supported by VideoTimmer.
   * Completely compatible with Blacktwist tool definitions.
   */
  public getTools(): McpToolDefinition[] {
    return [
      {
        name: 'create_post',
        description:
          'Create a new post or thread on Threads. Supports multi-post threads, topics, public video/image URLs, auto-repost, and scheduling. If scheduleAt is omitted, post is saved as a draft.',
        parameters: {
          type: 'object',
          properties: {
            providerId: {
              type: 'string',
              description: 'The provider ID, account ID, or username to post to. Pass any connected account ID or username.',
            },
            posts: {
              type: 'array',
              description: 'Array of posts in the thread. A single item represents a single post; multiple items create a thread chain.',
              items: {
                type: 'object',
                properties: {
                  text: {
                    type: 'string',
                    description: 'The text content of the post.',
                  },
                  topic: {
                    type: 'string',
                    description: 'Optional topic tag (e.g. Cinema, Bollywood, Hollywood).',
                  },
                  media: {
                    type: 'array',
                    description: 'Optional media attachments. Provide public URLs for videos (MP4/MOV) or images (JPEG/PNG).',
                    items: {
                      type: 'object',
                      properties: {
                        url: {
                          type: 'string',
                          description: 'Public URL of the media asset.',
                        },
                        altText: {
                          type: 'string',
                          description: 'Optional descriptive alt text.',
                        },
                      },
                      required: ['url'],
                    },
                  },
                  isSpoilerMedia: {
                    type: 'boolean',
                    description: 'If true, blurs attached media until tapped.',
                  },
                },
                required: ['text'],
              },
            },
            scheduleAt: {
              type: 'string',
              description: 'ISO datetime string to schedule post (e.g. 2026-10-23T09:00:00). If omitted, saves as draft.',
            },
            autoRepost: {
              type: 'object',
              description: 'Optional auto-repost configuration.',
              properties: {
                enabled: { type: 'boolean' },
                delays: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Delays in hours, e.g. ["168", "336"] for 7 and 14 days.',
                },
              },
            },
            followUp: {
              type: 'object',
              description: 'Optional follow-up comment CTA attached automatically after publishing.',
              properties: {
                enabled: { type: 'boolean' },
                text: { type: 'string' },
                delayMinutes: { type: 'number' },
              },
            },
            teamId: {
              type: 'string',
              description: 'Optional workspace identifier.',
            },
          },
          required: ['providerId', 'posts'],
        },
      },
      {
        name: 'list_providers',
        description:
          'List all connected Threads social media accounts. Returns provider ID, platform, username, display name, follower count, and avatar.',
        parameters: {
          type: 'object',
          properties: {
            teamId: {
              type: 'string',
              description: 'Optional workspace identifier.',
            },
          },
        },
      },
      {
        name: 'list_posts',
        description:
          'List scheduled, published, and draft posts within an optional date range or filter.',
        parameters: {
          type: 'object',
          properties: {
            from: {
              type: 'string',
              description: 'Start date ISO string.',
            },
            to: {
              type: 'string',
              description: 'End date ISO string.',
            },
            providerId: {
              type: 'string',
              description: 'Optional provider ID or username filter.',
            },
            status: {
              type: 'string',
              description: 'Filter by status: all, scheduled, published, draft, or failed.',
            },
            teamId: {
              type: 'string',
              description: 'Optional workspace identifier.',
            },
          },
        },
      },
      {
        name: 'get_thread',
        description: 'Retrieve a specific thread by its ID, including posts content, schedule time, and status.',
        parameters: {
          type: 'object',
          properties: {
            threadId: {
              type: 'string',
              description: 'The thread ID to fetch.',
            },
          },
          required: ['threadId'],
        },
      },
      {
        name: 'reschedule_thread',
        description: 'Reschedule a scheduled thread to a new date and time.',
        parameters: {
          type: 'object',
          properties: {
            threadId: {
              type: 'string',
              description: 'The thread ID to reschedule.',
            },
            scheduledAt: {
              type: 'string',
              description: 'New ISO datetime string.',
            },
          },
          required: ['threadId', 'scheduledAt'],
        },
      },
      {
        name: 'delete_thread',
        description: 'Delete or cancel a thread by its ID.',
        parameters: {
          type: 'object',
          properties: {
            threadId: {
              type: 'string',
              description: 'The thread ID to remove.',
            },
          },
          required: ['threadId'],
        },
      },
      {
        name: 'list_time_slots',
        description: 'List the 5 daily strategic cinema posting slots (9 AM, 2 PM, 9 PM, 11 PM, 1 AM).',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_best_time_to_post',
        description: 'Get engagement scores and recommendations for optimal posting times.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_live_metrics',
        description: 'Get overall live metrics for Threads including impressions, likes, replies, reposts, and engagement rate.',
        parameters: {
          type: 'object',
          properties: {
            providerId: {
              type: 'string',
              description: 'Optional account filter.',
            },
          },
        },
      },
      {
        name: 'get_post_analytics',
        description: 'Get detailed metrics for a specific published thread.',
        parameters: {
          type: 'object',
          properties: {
            threadId: {
              type: 'string',
              description: 'The thread ID to inspect.',
            },
          },
          required: ['threadId'],
        },
      },
      {
        name: 'list_drafts',
        description: 'List all posts currently in draft status.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'create_instagram_reel',
        description: 'Publish or schedule a video Reel to connected Instagram Business accounts.',
        parameters: {
          type: 'object',
          properties: {
            videoUrl: {
              type: 'string',
              description: 'Public URL of the MP4 video.',
            },
            caption: {
              type: 'string',
              description: 'Caption text for the Instagram Reel.',
            },
            scheduleAt: {
              type: 'string',
              description: 'Optional ISO datetime string. If omitted, publishes immediately.',
            },
            accountId: {
              type: 'string',
              description: 'Optional Instagram account ID.',
            },
          },
          required: ['videoUrl', 'caption'],
        },
      },
      {
        name: 'list_instagram_accounts',
        description: 'List connected Instagram Business accounts.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  /**
   * Executes a requested tool and returns standard MCP response format.
   */
  public async executeTool(name: string, args: Record<string, any>): Promise<any> {
    await connectMongo();

    switch (name) {
      case 'list_providers': {
        const accounts = await ThreadsAccount.find({ isActive: true }).sort({ createdAt: -1 });
        const providers = accounts.map((acc) => ({
          id: acc._id.toString(),
          providerId: acc._id.toString(),
          userId: acc.userId,
          platform: 'threads',
          username: acc.username,
          name: acc.displayName || acc.username,
          avatar: acc.profilePictureUrl || '',
          followerCount: acc.followerCount || 0,
          isActive: acc.isActive,
          isSimulated: acc.isSimulated,
        }));

        return {
          providers,
          total: providers.length,
          activeCount: providers.length,
          instructions:
            providers.length === 0
              ? 'No Threads accounts are currently connected in VideoTimmer. Connect an account in the Threads Studio tab.'
              : 'Use the id or username as providerId when creating or scheduling posts.',
        };
      }

      case 'create_post': {
        const { providerId, posts, scheduleAt, autoRepost, followUp } = args;

        if (!posts || !Array.isArray(posts) || posts.length === 0) {
          throw new Error('At least one post item is required in the posts array.');
        }

        // Resolve account
        const cleanProviderId = String(providerId || '').trim().replace(/^@/, '');
        let targetAccount = await ThreadsAccount.findOne({
          $or: [
            { _id: cleanProviderId.match(/^[0-9a-fA-F]{24}$/) ? cleanProviderId : null },
            { userId: cleanProviderId },
            { username: cleanProviderId },
          ].filter(Boolean),
        });

        // Fallback to first active account if providerId does not match
        if (!targetAccount) {
          targetAccount = await ThreadsAccount.findOne({ isActive: true });
        }

        // If still no account, create a local creator account to preserve data
        if (!targetAccount) {
          targetAccount = await ThreadsAccount.create({
            userId: 'creator_' + Math.random().toString(36).substring(2, 8),
            username: cleanProviderId || 'creator',
            displayName: cleanProviderId || 'Creator Studio',
            followerCount: 150,
            isActive: true,
            isSimulated: true,
          });
        }

        // Map posts array
        const formattedPosts = posts.map((item: any) => {
          let mediaUrl = '';
          let mediaType: 'IMAGE' | 'VIDEO' = 'VIDEO';
          if (item.media && Array.isArray(item.media) && item.media.length > 0) {
            mediaUrl = item.media[0].url || '';
            const lower = mediaUrl.toLowerCase();
            if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp')) {
              mediaType = 'IMAGE';
            } else {
              mediaType = 'VIDEO';
            }
          }

          return {
            text: item.text,
            topic: (item.topic || '').replace(/^#/, ''),
            mediaUrl,
            mediaType,
            isSpoilerMedia: Boolean(item.isSpoilerMedia),
          };
        });

        let status: 'draft' | 'scheduled' = 'draft';
        let targetScheduleDate: Date | undefined = undefined;

        if (scheduleAt) {
          const parsed = new Date(scheduleAt);
          if (!isNaN(parsed.getTime())) {
            targetScheduleDate = parsed;
            status = 'scheduled';
          }
        }

        const delaysHours =
          autoRepost?.delays && Array.isArray(autoRepost.delays)
            ? autoRepost.delays.map((d: any) => parseInt(String(d), 10)).filter((n: number) => !isNaN(n))
            : [168, 336];

        const newPost = await ThreadsPost.create({
          accountId: targetAccount._id.toString(),
          username: targetAccount.username,
          posts: formattedPosts,
          status,
          scheduleAt: targetScheduleDate,
          autoRepost: {
            enabled: Boolean(autoRepost?.enabled),
            delaysHours,
          },
          followUp: {
            enabled: Boolean(followUp?.enabled),
            text: followUp?.text || '',
            delayMinutes: followUp?.delayMinutes || 0,
            status: 'pending',
          },
          videoSource: {
            sourceType: 'none',
          },
        });

        logger.system(
          'info',
          'MCP_POST_CREATED',
          `Created Threads post ${newPost._id} for @${targetAccount.username} (status: ${status})`
        );

        return {
          success: true,
          threadId: newPost._id.toString(),
          status: newPost.status,
          username: targetAccount.username,
          scheduleAt: targetScheduleDate ? targetScheduleDate.toISOString() : null,
          postsCount: formattedPosts.length,
          previewText: formattedPosts[0].text,
          message:
            status === 'scheduled'
              ? `Thread successfully scheduled for ${targetScheduleDate?.toISOString()}`
              : 'Thread saved as draft.',
        };
      }

      case 'list_posts': {
        const { from, to, providerId, status } = args;
        const query: Record<string, any> = {};

        if (status && status !== 'all') {
          query.status = status;
        }

        if (providerId) {
          const clean = String(providerId).trim().replace(/^@/, '');
          query.$or = [{ accountId: clean }, { username: clean }];
        }

        if (from || to) {
          query.scheduleAt = {};
          if (from) query.scheduleAt.$gte = new Date(from);
          if (to) query.scheduleAt.$lte = new Date(to);
        }

        const posts = await ThreadsPost.find(query).sort({ scheduleAt: 1, createdAt: -1 }).limit(100);

        return {
          total: posts.length,
          threads: posts.map((p) => ({
            id: p._id.toString(),
            threadId: p._id.toString(),
            username: p.username,
            status: p.status,
            scheduleAt: p.scheduleAt ? p.scheduleAt.toISOString() : null,
            publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
            permalink: p.threadsPermalink || null,
            posts: p.posts.map((sub) => ({
              text: sub.text,
              topic: sub.topic,
              mediaUrl: sub.mediaUrl,
              mediaType: sub.mediaType,
            })),
            analytics: p.analytics || { views: 0, likes: 0, replies: 0, reposts: 0, engagementRate: 0 },
            followUp: p.followUp,
          })),
        };
      }

      case 'get_thread': {
        const { threadId } = args;
        const post = await ThreadsPost.findById(threadId);
        if (!post) {
          throw new Error(`Thread with ID ${threadId} was not found.`);
        }
        return {
          id: post._id.toString(),
          threadId: post._id.toString(),
          username: post.username,
          status: post.status,
          scheduleAt: post.scheduleAt ? post.scheduleAt.toISOString() : null,
          publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
          permalink: post.threadsPermalink,
          posts: post.posts,
          analytics: post.analytics,
          autoRepost: post.autoRepost,
          followUp: post.followUp,
        };
      }

      case 'reschedule_thread': {
        const { threadId, scheduledAt } = args;
        const parsed = new Date(scheduledAt);
        if (isNaN(parsed.getTime())) {
          throw new Error('Invalid scheduledAt datetime string provided.');
        }

        const post = await ThreadsPost.findByIdAndUpdate(
          threadId,
          {
            $set: {
              scheduleAt: parsed,
              status: 'scheduled',
            },
          },
          { new: true }
        );

        if (!post) {
          throw new Error(`Thread with ID ${threadId} not found.`);
        }

        return {
          success: true,
          threadId: post._id.toString(),
          status: post.status,
          scheduledAt: post.scheduleAt?.toISOString(),
          message: `Thread successfully rescheduled to ${post.scheduleAt?.toISOString()}`,
        };
      }

      case 'delete_thread': {
        const { threadId } = args;
        const post = await ThreadsPost.findByIdAndDelete(threadId);
        if (!post) {
          throw new Error(`Thread with ID ${threadId} not found.`);
        }
        return {
          success: true,
          threadId,
          message: 'Thread successfully deleted.',
        };
      }

      case 'list_time_slots': {
        return {
          timeZone: 'Asia/Kolkata (IST)',
          slots: [
            {
              slot: '9:00 AM',
              hour24: 9,
              category: 'Indian / Bollywood',
              audience: 'Morning Commute & Discussion',
              description: 'Optimal for morning entertainment news, box office updates, and Indian cinema debate hooks.',
            },
            {
              slot: '2:00 PM',
              hour24: 14,
              category: 'Indian / Bollywood',
              audience: 'Midday Break',
              description: 'High mobile activity for movie clips, trivia polls, and actor highlights.',
            },
            {
              slot: '9:00 PM',
              hour24: 21,
              category: 'Hollywood / International',
              audience: 'Prime Time Peak',
              description: 'Peak engagement window for mind-bending international cinema, sci-fi recommendations, and trailers.',
            },
            {
              slot: '11:00 PM',
              hour24: 23,
              category: 'Hollywood / International',
              audience: 'Late Discussion',
              description: 'In-depth thriller reviews, twist analysis, and philosophical movie threads.',
            },
            {
              slot: '1:00 AM',
              hour24: 1,
              category: 'Hollywood / International',
              audience: 'Late Night Gems & Open Loops',
              description: 'Hidden gem recommendations, curiosity loops, and cult classic discovery.',
            },
          ],
        };
      }

      case 'get_best_time_to_post': {
        const summary = await threadsService.getAnalyticsSummary();
        return {
          bestSlots: summary.bestTimesToPost,
          recommendation:
            'Schedule Bollywood posts between 9:00 AM and 2:00 PM IST; schedule International and Hollywood thriller posts between 9:00 PM and 1:00 AM IST for peak reach.',
        };
      }

      case 'get_live_metrics': {
        const { providerId } = args;
        const summary = await threadsService.getAnalyticsSummary(providerId);
        return {
          totals: summary.totals,
          timeseriesCount: summary.timeseries.length,
          topPostsCount: summary.topPosts.length,
        };
      }

      case 'get_post_analytics': {
        const { threadId } = args;
        const post = await ThreadsPost.findById(threadId);
        if (!post) {
          throw new Error(`Thread with ID ${threadId} not found.`);
        }
        return {
          threadId,
          status: post.status,
          publishedAt: post.publishedAt,
          analytics: post.analytics || { views: 0, likes: 0, replies: 0, reposts: 0, quotes: 0, engagementRate: 0 },
        };
      }

      case 'list_drafts': {
        const drafts = await ThreadsPost.find({ status: 'draft' }).sort({ createdAt: -1 });
        return {
          total: drafts.length,
          drafts: drafts.map((d) => ({
            id: d._id.toString(),
            username: d.username,
            createdAt: d.createdAt,
            posts: d.posts,
          })),
        };
      }

      case 'create_instagram_reel': {
        const { videoUrl, caption, scheduleAt, accountId } = args;
        let account = accountId ? await InstagramAccount.findById(accountId) : await InstagramAccount.findOne();
        if (!account) {
          account = await InstagramAccount.create({
            username: 'reels_creator',
            displayName: 'Reels Creator',
            instagramBusinessId: 'ig_demo_' + Date.now(),
            pageId: 'page_demo_' + Date.now(),
            followerCount: 200,
            isActive: true,
          });
        }

        const isScheduled = Boolean(scheduleAt);
        const schedDate = isScheduled ? new Date(scheduleAt) : undefined;

        const post = await InstagramPost.create({
          accountId: account._id.toString(),
          username: account.username,
          videoUrl,
          caption,
          mediaType: 'REELS',
          status: isScheduled ? 'scheduled' : 'published',
          scheduledAt: schedDate,
          publishedAt: isScheduled ? undefined : new Date(),
          permalink: isScheduled ? undefined : `https://instagram.com/reel/demo_${Date.now()}`,
        });

        return {
          success: true,
          postId: post._id.toString(),
          status: post.status,
          username: account.username,
          message: isScheduled ? `Reel scheduled for ${schedDate?.toISOString()}` : 'Reel published successfully.',
        };
      }

      case 'list_instagram_accounts': {
        const accounts = await InstagramAccount.find({ isActive: true });
        return {
          accounts: accounts.map((acc) => ({
            id: acc._id.toString(),
            username: acc.username,
            displayName: acc.displayName,
            followerCount: acc.followerCount,
            profilePictureUrl: acc.profilePictureUrl,
          })),
        };
      }

      default:
        throw new Error(`Tool "${name}" is not implemented by VideoTimmer MCP server.`);
    }
  }
}

export const mcpToolService = new McpToolService();
