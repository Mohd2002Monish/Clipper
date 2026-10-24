import fs from 'fs';
import path from 'path';

const tools = [
  {
    name: 'create_post',
    description: 'Create a new post or thread on Threads. Supports multi-post threads, topics, public video/image URLs, auto-repost, and scheduling. If scheduleAt is omitted, post is saved as a draft.',
    parameters: {
      type: 'object',
      properties: {
        providerId: {
          type: 'string',
          description: 'The provider ID, account ID, or username to post to.',
        },
        posts: {
          type: 'array',
          description: 'Array of posts in the thread.',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'The text content of the post.' },
              topic: { type: 'string', description: 'Optional topic tag.' },
              media: {
                type: 'array',
                description: 'Optional media attachments (public URLs).',
                items: {
                  type: 'object',
                  properties: {
                    url: { type: 'string', description: 'Public URL of media asset.' },
                    altText: { type: 'string', description: 'Optional alt text.' },
                  },
                  required: ['url'],
                },
              },
              isSpoilerMedia: { type: 'boolean', description: 'If true, blurs media until tapped.' },
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
            delays: { type: 'array', items: { type: 'string' } },
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
        teamId: { type: 'string', description: 'Optional workspace identifier.' },
      },
      required: ['providerId', 'posts'],
    },
  },
  {
    name: 'list_providers',
    description: 'List all connected Threads social media accounts. Returns provider ID, platform, username, display name, follower count, and avatar.',
    parameters: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'Optional workspace identifier.' },
      },
    },
  },
  {
    name: 'list_posts',
    description: 'List scheduled, published, and draft posts within an optional date range or filter.',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Start date ISO string.' },
        to: { type: 'string', description: 'End date ISO string.' },
        providerId: { type: 'string', description: 'Optional provider ID or username filter.' },
        status: { type: 'string', description: 'Filter by status: all, scheduled, published, draft, or failed.' },
        teamId: { type: 'string', description: 'Optional workspace identifier.' },
      },
    },
  },
  {
    name: 'get_thread',
    description: 'Retrieve a specific thread by its ID, including posts content, schedule time, and status.',
    parameters: {
      type: 'object',
      properties: {
        threadId: { type: 'string', description: 'The thread ID to fetch.' },
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
        threadId: { type: 'string', description: 'The thread ID to reschedule.' },
        scheduledAt: { type: 'string', description: 'New ISO datetime string.' },
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
        threadId: { type: 'string', description: 'The thread ID to remove.' },
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
        providerId: { type: 'string', description: 'Optional account filter.' },
      },
    },
  },
  {
    name: 'get_post_analytics',
    description: 'Get detailed metrics for a specific published thread.',
    parameters: {
      type: 'object',
      properties: {
        threadId: { type: 'string', description: 'The thread ID to inspect.' },
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
        videoUrl: { type: 'string', description: 'Public URL of the MP4 video.' },
        caption: { type: 'string', description: 'Caption text for the Instagram Reel.' },
        scheduleAt: { type: 'string', description: 'Optional ISO datetime string. If omitted, publishes immediately.' },
        accountId: { type: 'string', description: 'Optional Instagram account ID.' },
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

const targetDir = '/Users/mohd2002monish/.gemini/antigravity-ide/mcp/videotimmer';
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

for (const tool of tools) {
  const filePath = path.join(targetDir, `${tool.name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(tool, null, 2), 'utf-8');
  console.log(`Generated: ${filePath}`);
}

console.log('All schemas generated successfully.');
