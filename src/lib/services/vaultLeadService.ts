import { connectMongo } from '../db';
import { VaultLead, IVaultLeadDocument, VaultLeadStatus } from '../../models/VaultLead';
import { InstagramPost } from '../../models/InstagramPost';
import { InstagramAccount } from '../../models/InstagramAccount';
import { ThreadsPost } from '../../models/ThreadsPost';
import { ThreadsAccount } from '../../models/ThreadsAccount';
import { FacebookPost } from '../../models/FacebookPost';
import { FacebookAccount } from '../../models/FacebookAccount';
import { safeDecryptToken } from './crypto';
import { config } from '../config';
import { logger } from '../logger/logger';

export class VaultLeadService {
  /**
   * Retrieves all captured Movie Vault leads with optional filtering and pagination.
   */
  public async getLeads(filters: {
    status?: string;
    platform?: string;
    search?: string;
    limit?: number;
    skip?: number;
  } = {}): Promise<{
    leads: IVaultLeadDocument[];
    total: number;
    metrics: {
      total: number;
      newLeads: number;
      contacted: number;
      accessSent: number;
    };
  }> {
    await connectMongo();

    const query: Record<string, any> = {};

    if (filters.status && filters.status !== 'all') {
      query.status = filters.status;
    }
    if (filters.platform && filters.platform !== 'all') {
      query.platform = filters.platform;
    }
    if (filters.search) {
      const regex = new RegExp(filters.search.trim(), 'i');
      query.$or = [{ username: regex }, { commentText: regex }, { postTitleOrHook: regex }];
    }

    const limit = filters.limit || 50;
    const skip = filters.skip || 0;

    const [leads, total, counts] = await Promise.all([
      VaultLead.find(query).sort({ discoveredAt: -1 }).skip(skip).limit(limit),
      VaultLead.countDocuments(query),
      VaultLead.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const metrics = {
      total: 0,
      newLeads: 0,
      contacted: 0,
      accessSent: 0,
    };

    counts.forEach((c) => {
      metrics.total += c.count;
      if (c._id === 'new') metrics.newLeads = c.count;
      if (c._id === 'contacted') metrics.contacted = c.count;
      if (c._id === 'access_sent') metrics.accessSent = c.count;
    });

    return { leads, total, metrics };
  }

  /**
   * Updates lead status and optional notes.
   */
  public async updateLead(
    id: string,
    updates: { status?: VaultLeadStatus; notes?: string }
  ): Promise<IVaultLeadDocument | null> {
    await connectMongo();
    const updatePayload: Record<string, any> = { ...updates };

    if (updates.status === 'contacted' || updates.status === 'access_sent') {
      updatePayload.contactedAt = new Date();
    }

    return VaultLead.findByIdAndUpdate(id, updatePayload, { new: true });
  }

  /**
   * Deletes a lead by ID.
   */
  public async deleteLead(id: string): Promise<boolean> {
    await connectMongo();
    const res = await VaultLead.findByIdAndDelete(id);
    return !!res;
  }

  /**
   * Scans Instagram, Threads, and Facebook posts for #VAULT comments and ingests them.
   */
  public async scanForVaultComments(): Promise<{
    newLeadsFound: number;
    scannedPostsCount: number;
  }> {
    await connectMongo();

    let newLeadsFound = 0;
    let scannedPostsCount = 0;

    // 1. Scan Instagram Comments
    try {
      const igPosts = await InstagramPost.find({
        status: 'published',
        instagramMediaId: { $exists: true, $ne: '' },
      })
        .sort({ publishedAt: -1 })
        .limit(15);

      for (const p of igPosts) {
        scannedPostsCount++;
        const acc = await InstagramAccount.findById(p.accountId);
        if (!acc || !acc.accessToken) continue;

        const token = safeDecryptToken(acc.accessToken);
        const apiBase = config.instagramApiBaseUrl;
        const apiVer = config.instagramApiVersion;

        try {
          const res = await fetch(
            `${apiBase}/${apiVer}/${p.instagramMediaId}/comments?fields=id,text,username,timestamp&access_token=${encodeURIComponent(
              token
            )}`
          );
          const data = await res.json();
          if (res.ok && Array.isArray(data.data)) {
            for (const comment of data.data) {
              const text = String(comment.text || '');
              if (/#vault\b|vault/i.test(text)) {
                const commentId = String(comment.id || '');
                const existing = await VaultLead.findOne({ commentId });
                if (!existing) {
                  await VaultLead.create({
                    platform: 'instagram',
                    username: comment.username || 'instagram_user',
                    externalUserId: comment.id,
                    postId: p._id.toString(),
                    postTitleOrHook: p.caption?.substring(0, 60) || 'Instagram Reel',
                    commentId,
                    commentText: text,
                    status: 'new',
                    discoveredAt: comment.timestamp ? new Date(comment.timestamp) : new Date(),
                  });
                  newLeadsFound++;
                }
              }
            }
          }
        } catch (err) {
          logger.system('warn', 'VAULT_IG_SCAN_ERR', `Failed scanning IG media ${p.instagramMediaId}: ${err}`);
        }
      }
    } catch (err) {
      logger.system('warn', 'VAULT_IG_ERR', `Instagram scan error: ${err}`);
    }

    // 2. Scan Threads Replies
    try {
      const thPosts = await ThreadsPost.find({
        status: 'published',
      })
        .sort({ publishedAt: -1 })
        .limit(15);

      for (const p of thPosts) {
        scannedPostsCount++;
        const mediaId = p.posts?.[0]?.threadsMediaId || p.threadsContainerId;
        if (!mediaId) continue;

        const acc = await ThreadsAccount.findById(p.accountId);
        if (!acc || !acc.accessToken) continue;

        try {
          const res = await fetch(
            `https://graph.threads.net/v1.0/${mediaId}/conversation?fields=id,text,username,timestamp&access_token=${encodeURIComponent(
              acc.accessToken
            )}`
          );
          const data = await res.json();
          if (res.ok && Array.isArray(data.data)) {
            for (const reply of data.data) {
              const text = String(reply.text || '');
              if (/#vault\b|vault/i.test(text)) {
                const commentId = String(reply.id || '');
                const existing = await VaultLead.findOne({ commentId });
                if (!existing) {
                  await VaultLead.create({
                    platform: 'threads',
                    username: reply.username || 'threads_user',
                    externalUserId: reply.id,
                    postId: p._id.toString(),
                    postTitleOrHook: p.posts?.[0]?.text?.substring(0, 60) || 'Threads Post',
                    commentId,
                    commentText: text,
                    status: 'new',
                    discoveredAt: reply.timestamp ? new Date(reply.timestamp) : new Date(),
                  });
                  newLeadsFound++;
                }
              }
            }
          }
        } catch (err) {
          logger.system('warn', 'VAULT_TH_SCAN_ERR', `Failed scanning Threads media ${mediaId}: ${err}`);
        }
      }
    } catch (err) {
      logger.system('warn', 'VAULT_TH_ERR', `Threads scan error: ${err}`);
    }

    // 3. Scan Facebook Comments
    try {
      const fbPosts = await FacebookPost.find({
        status: 'published',
        facebookPostId: { $exists: true, $ne: '' },
      })
        .sort({ publishedAt: -1 })
        .limit(15);

      for (const p of fbPosts) {
        scannedPostsCount++;
        const acc = await FacebookAccount.findById(p.accountId);
        if (!acc || !acc.accessToken) continue;

        const token = safeDecryptToken(acc.accessToken);
        try {
          const res = await fetch(
            `https://graph.facebook.com/v20.0/${p.facebookPostId}/comments?fields=id,message,from,created_time&access_token=${encodeURIComponent(
              token
            )}`
          );
          const data = await res.json();
          if (res.ok && Array.isArray(data.data)) {
            for (const comment of data.data) {
              const text = String(comment.message || '');
              if (/#vault\b|vault/i.test(text)) {
                const commentId = String(comment.id || '');
                const existing = await VaultLead.findOne({ commentId });
                if (!existing) {
                  await VaultLead.create({
                    platform: 'facebook',
                    username: comment.from?.name || comment.from?.id || 'facebook_user',
                    userDisplayName: comment.from?.name,
                    externalUserId: comment.from?.id,
                    postId: p._id.toString(),
                    postTitleOrHook: p.title || p.message?.substring(0, 60) || 'Facebook Video',
                    commentId,
                    commentText: text,
                    status: 'new',
                    discoveredAt: comment.created_time ? new Date(comment.created_time) : new Date(),
                  });
                  newLeadsFound++;
                }
              }
            }
          }
        } catch (err) {
          logger.system('warn', 'VAULT_FB_SCAN_ERR', `Failed scanning FB post ${p.facebookPostId}: ${err}`);
        }
      }
    } catch (err) {
      logger.system('warn', 'VAULT_FB_ERR', `Facebook scan error: ${err}`);
    }

    return { newLeadsFound, scannedPostsCount };
  }

  /**
   * Generates a standard CSV string of all leads for export.
   */
  public async exportLeadsToCsv(): Promise<string> {
    await connectMongo();
    const leads = await VaultLead.find().sort({ discoveredAt: -1 });

    const headers = ['Platform', 'Username', 'Status', 'Discovered At', 'Comment Text', 'Post Reference', 'Notes'];
    const rows = leads.map((l) => [
      l.platform,
      `@${l.username}`,
      l.status,
      l.discoveredAt ? l.discoveredAt.toISOString() : '',
      `"${(l.commentText || '').replace(/"/g, '""')}"`,
      `"${(l.postTitleOrHook || '').replace(/"/g, '""')}"`,
      `"${(l.notes || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}

export const vaultLeadService = new VaultLeadService();
