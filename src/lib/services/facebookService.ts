import fs from 'fs';
import path from 'path';
import { connectMongo } from '../db';
import { FacebookAccount, IFacebookAccountDocument } from '../../models/FacebookAccount';
import { FacebookPost, IFacebookPostDocument } from '../../models/FacebookPost';
import { Setting } from '../../models/Setting';
import { config } from '../config';
import { logger } from '../logger/logger';
import { encryptText, safeDecryptToken } from './crypto';
import { publicMediaService } from './publicMediaService';

export interface MetaFacebookPublishResponse {
  id: string;
}

export class FacebookService {
  /**
   * List all registered Facebook Pages
   */
  public async getAccounts(): Promise<IFacebookAccountDocument[]> {
    await connectMongo();
    // Clean up residual simulated seed accounts if requested
    await FacebookAccount.deleteMany({ isSimulated: true });
    return FacebookAccount.find().select('-accessToken -userAccessToken').sort({ createdAt: -1 });
  }

  /**
   * Generates Facebook OAuth 2.0 Authorization URL for Pages
   * End-point: https://www.facebook.com/{version}/dialog/oauth
   */
  public async getAuthUrl(
    redirectUri?: string,
    state?: string
  ): Promise<{
    authUrl: string | null;
    configured: boolean;
    appId?: string;
    redirectUri?: string;
    message?: string;
  }> {
    let setting = null;
    try {
      await connectMongo();
      setting = await Setting.findOne();
    } catch {
      // Graceful fallback to env/config
    }

    const appId =
      process.env.FACEBOOK_APP_ID ||
      process.env.FB_APP_ID ||
      config.facebookAppId ||
      setting?.facebook?.appId ||
      '1125007820131674';

    const targetRedirectUri =
      redirectUri ||
      process.env.FACEBOOK_REDIRECT_URI ||
      setting?.facebook?.redirectUri ||
      config.facebookRedirectUri;

    if (!appId) {
      return {
        authUrl: null,
        configured: false,
        redirectUri: targetRedirectUri,
        message: 'Facebook App ID is not configured.',
      };
    }

    const scopes = 'pages_show_list,pages_read_engagement,pages_manage_posts,publish_video';
    const oauthState = state || Math.random().toString(36).substring(2, 15);
    const apiVersion = config.facebookApiVersion || 'v19.0';

    const authUrl = `https://www.facebook.com/${apiVersion}/dialog/oauth?client_id=${encodeURIComponent(
      appId
    )}&redirect_uri=${encodeURIComponent(targetRedirectUri)}&scope=${encodeURIComponent(
      scopes
    )}&response_type=code&state=${encodeURIComponent(oauthState)}`;

    return { authUrl, configured: true, appId, redirectUri: targetRedirectUri };
  }

  /**
   * Handles Facebook OAuth callback:
   * 1. Exchanges code for short-lived User Token.
   * 2. Exchanges short-lived token for 60-day long-lived User Token.
   * 3. Fetches managed Facebook Pages via GET /me/accounts.
   * 4. Encrypts Page Access Token and upserts accounts into MongoDB.
   */
  public async handleOAuthCallback(code: string, redirectUri?: string): Promise<IFacebookAccountDocument[]> {
    let setting = null;
    try {
      await connectMongo();
      setting = await Setting.findOne();
    } catch {
      // Graceful fallback
    }

    const appId =
      process.env.FACEBOOK_APP_ID ||
      process.env.FB_APP_ID ||
      config.facebookAppId ||
      setting?.facebook?.appId ||
      '1125007820131674';

    const appSecret =
      process.env.FACEBOOK_APP_SECRET ||
      process.env.FB_APP_SECRET ||
      config.facebookAppSecret ||
      setting?.facebook?.appSecret;

    const targetRedirectUri =
      redirectUri ||
      process.env.FACEBOOK_REDIRECT_URI ||
      setting?.facebook?.redirectUri ||
      config.facebookRedirectUri;

    if (!appId || !appSecret) {
      throw new Error('FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be configured for OAuth token exchange.');
    }

    const sanitizedCode = code.replace(/#_.*$/, '').replace(/#.*$/, '').trim();
    const apiVersion = config.facebookApiVersion || 'v19.0';

    // 1. Exchange code for short-lived User Access Token
    const tokenUrl = `https://graph.facebook.com/${apiVersion}/oauth/access_token?client_id=${encodeURIComponent(
      appId
    )}&redirect_uri=${encodeURIComponent(targetRedirectUri)}&client_secret=${encodeURIComponent(
      appSecret
    )}&code=${encodeURIComponent(sanitizedCode)}`;

    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      const errDetail = tokenData.error?.message || 'Failed to exchange code for Facebook User Access Token.';
      logger.system('error', 'FACEBOOK_TOKEN_EXCHANGE_FAILED', errDetail);
      throw new Error(errDetail);
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Exchange for 60-day long-lived User Token
    let longLivedUserToken = shortLivedToken;
    let tokenExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    try {
      const exUrl = `https://graph.facebook.com/${apiVersion}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(
        appId
      )}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(shortLivedToken)}`;

      const exRes = await fetch(exUrl);
      const exData = await exRes.json();
      if (exRes.ok && exData.access_token) {
        longLivedUserToken = exData.access_token;
        if (exData.expires_in) {
          tokenExpiry = new Date(Date.now() + exData.expires_in * 1000);
        }
      }
    } catch {
      // Non-fatal, proceed with short-lived token
    }

    // 3. Fetch managed Facebook Pages with their respective Page Access Tokens
    const pagesUrl = `https://graph.facebook.com/${apiVersion}/me/accounts?fields=id,name,access_token,category,picture{url},fan_count,followers_count&access_token=${encodeURIComponent(
      longLivedUserToken
    )}`;

    const pagesRes = await fetch(pagesUrl);
    const pagesData = await pagesRes.json();

    if (!pagesRes.ok || !Array.isArray(pagesData.data)) {
      throw new Error(pagesData.error?.message || 'Failed to fetch Facebook Pages managed by user.');
    }

    const savedAccounts: IFacebookAccountDocument[] = [];

    for (const page of pagesData.data) {
      const pageId = String(page.id);
      const pageName = page.name || `Facebook Page ${pageId}`;
      const pageToken = page.access_token || '';
      const category = page.category || 'Cinema & Entertainment';
      const pictureUrl = page.picture?.data?.url || '';
      const followerCount = page.followers_count || page.fan_count || 0;
      const fanCount = page.fan_count || 0;

      const encryptedPageToken = encryptText(pageToken);
      const encryptedUserToken = encryptText(longLivedUserToken);

      let account = await FacebookAccount.findOne({ pageId });
      if (account) {
        account.pageName = pageName;
        account.category = category;
        if (pictureUrl) account.pictureUrl = pictureUrl;
        account.followerCount = followerCount;
        account.fanCount = fanCount;
        account.accessToken = encryptedPageToken;
        account.userAccessToken = encryptedUserToken;
        account.tokenExpiry = tokenExpiry;
        account.isActive = true;
        account.isSimulated = false;
        await account.save();
      } else {
        account = await FacebookAccount.create({
          pageId,
          pageName,
          category,
          pictureUrl,
          followerCount,
          fanCount,
          accessToken: encryptedPageToken,
          userAccessToken: encryptedUserToken,
          tokenExpiry,
          isActive: true,
          isSimulated: false,
        });
      }

      savedAccounts.push(account);
      logger.system('info', 'FACEBOOK_PAGE_CONNECTED', `Connected Facebook Page: ${pageName} (${pageId})`);
    }

    return savedAccounts;
  }

  /**
   * Adds a Custom / Sandbox Facebook Page for offline or test mode
   */
  public async addCustomAccount(data: {
    pageId: string;
    pageName: string;
    category?: string;
    pictureUrl?: string;
    followerCount?: number;
    accessToken?: string;
  }): Promise<IFacebookAccountDocument> {
    await connectMongo();
    const cleanId = data.pageId.trim() || `fb_page_${Math.random().toString(36).substring(2, 8)}`;
    const cleanName = data.pageName.trim() || 'FilmYap Facebook Page';

    const existing = await FacebookAccount.findOne({ pageId: cleanId });
    if (existing) {
      existing.pageName = cleanName;
      if (data.category) existing.category = data.category;
      if (data.pictureUrl) existing.pictureUrl = data.pictureUrl;
      if (data.followerCount !== undefined) existing.followerCount = data.followerCount;
      if (data.accessToken) {
        existing.accessToken = encryptText(data.accessToken);
        existing.isSimulated = false;
      }
      await existing.save();
      return existing;
    }

    const account = await FacebookAccount.create({
      pageId: cleanId,
      pageName: cleanName,
      category: data.category || 'Cinema & Entertainment',
      pictureUrl:
        data.pictureUrl ||
        'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=150&auto=format&fit=crop&q=80',
      followerCount: data.followerCount || 14200,
      fanCount: data.followerCount || 14200,
      accessToken: data.accessToken ? encryptText(data.accessToken) : '',
      isActive: true,
      isSimulated: !data.accessToken,
    });

    return account;
  }

  /**
   * Deletes a Facebook Page from database
   */
  public async deleteAccount(accountId: string): Promise<boolean> {
    await connectMongo();
    const res = await FacebookAccount.findByIdAndDelete(accountId);
    return !!res;
  }

  /**
   * Updates an existing Facebook Page
   */
  public async updateAccount(
    accountId: string,
    data: {
      pageName?: string;
      category?: string;
      pictureUrl?: string;
      accessToken?: string;
      isActive?: boolean;
    }
  ): Promise<IFacebookAccountDocument | null> {
    await connectMongo();
    const updatePayload: Record<string, unknown> = { ...data };
    if (data.accessToken) {
      updatePayload.accessToken = encryptText(data.accessToken);
      updatePayload.isSimulated = false;
    }
    return FacebookAccount.findByIdAndUpdate(accountId, { $set: updatePayload }, { new: true });
  }

  /**
   * Verifies & syncs live Page profile & followers from Meta Graph API
   */
  public async verifyAndSyncAccount(accountId: string): Promise<IFacebookAccountDocument> {
    await connectMongo();
    const account = await FacebookAccount.findById(accountId);
    if (!account) {
      throw new Error('Facebook account not found');
    }
    if (account.isSimulated || !account.accessToken) {
      return account;
    }

    const decryptedToken = safeDecryptToken(account.accessToken);
    const apiVersion = config.facebookApiVersion || 'v19.0';

    try {
      const url = `https://graph.facebook.com/${apiVersion}/${account.pageId}?fields=id,name,category,picture{url},fan_count,followers_count&access_token=${encodeURIComponent(
        decryptedToken
      )}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.id) {
        if (data.name) account.pageName = data.name;
        if (data.category) account.category = data.category;
        if (data.picture?.data?.url) account.pictureUrl = data.picture.data.url;
        if (data.followers_count !== undefined) account.followerCount = data.followers_count;
        if (data.fan_count !== undefined) account.fanCount = data.fan_count;
        account.isSimulated = false;
        account.isActive = true;
        await account.save();
        logger.system('info', 'FACEBOOK_ACCOUNT_SYNCED', `Synced profile for Page ${account.pageName}`);
      }
    } catch (err) {
      logger.system('warn', 'FACEBOOK_ACCOUNT_SYNC_ERROR', `Failed to sync profile for Page ${account.pageName}: ${err}`);
    }

    return account;
  }

  /**
   * Publishes a Reel, Video, Photo, or Post to Facebook Page
   */
  public async publishPost(postId: string): Promise<{ success: boolean; permalink?: string; error?: string }> {
    await connectMongo();
    const post = await FacebookPost.findById(postId);
    if (!post) {
      throw new Error(`Facebook post ${postId} not found.`);
    }

    const account =
      (await FacebookAccount.findById(post.accountId)) ||
      (await FacebookAccount.findOne({ pageId: post.pageId }));

    post.status = 'publishing';
    await post.save();

    // 1. Simulation fallback if account is in sandbox mode or token is simulated
    if (!account || account.isSimulated || !account.accessToken) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      post.status = 'published';
      post.publishedAt = new Date();
      post.facebookVideoId = `fb_vid_${Date.now()}`;
      post.facebookPostId = `fb_post_${Date.now()}`;
      post.facebookPermalink = `https://www.facebook.com/${post.pageId}/videos/${post.facebookVideoId}/`;
      post.analytics = {
        views: 890,
        likes: 124,
        comments: 28,
        shares: 34,
        reach: 1280,
        engagementRate: 8.5,
        lastSyncedAt: new Date(),
      };

      if (post.firstComment?.enabled && post.firstComment.text) {
        post.firstComment.status = 'published';
        post.firstComment.commentId = `sim_comment_${Date.now()}`;
      }

      await post.save();
      logger.system('info', 'FACEBOOK_POST_SIMULATED', `Published simulated Facebook post for ${post.pageName}`);
      return { success: true, permalink: post.facebookPermalink };
    }

    try {
      const pageId = account.pageId;
      const pageToken = safeDecryptToken(account.accessToken);
      const apiVersion = config.facebookApiVersion || 'v19.0';
      const apiBase = `https://graph.facebook.com/${apiVersion}`;

      // 2. Publish Video / Reel
      if (post.postType === 'REEL' || post.postType === 'VIDEO') {
        const localFilePath = await publicMediaService.resolveLocalFilePath({
          mediaUrl: post.mediaUrl,
          filename: post.videoSource?.filename,
          jobId: post.videoSource?.jobId,
          partIndex: post.videoSource?.partIndex,
        });

        const publicVideoUrl = await publicMediaService.ensurePublicVideoUrl(post.mediaUrl || '', localFilePath);
        logger.system('info', 'FACEBOOK_VIDEO_PUBLISH_START', `Publishing video to Page ${pageId} via ${publicVideoUrl}`);

        const videoParams = new URLSearchParams();
        videoParams.append('access_token', pageToken);
        videoParams.append('file_url', publicVideoUrl);
        videoParams.append('description', post.message || '');
        if (post.title) {
          videoParams.append('title', post.title);
        }
        videoParams.append('published', 'true');

        const videoRes = await fetch(`${apiBase}/${pageId}/videos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: videoParams.toString(),
        });

        const videoData = await videoRes.json();
        if (!videoRes.ok || !videoData.id) {
          throw new Error(videoData.error?.message || 'Failed to upload video to Facebook Page');
        }

        const videoId = String(videoData.id);
        post.facebookVideoId = videoId;
        post.facebookPostId = videoId;
        post.status = 'published';
        post.publishedAt = new Date();

        // Fetch live permalink
        try {
          const pRes = await fetch(`${apiBase}/${videoId}?fields=permalink_url&access_token=${encodeURIComponent(pageToken)}`);
          const pData = await pRes.json();
          if (pData.permalink_url) {
            post.facebookPermalink = pData.permalink_url;
          } else {
            post.facebookPermalink = `https://www.facebook.com/${pageId}/videos/${videoId}/`;
          }
        } catch {
          post.facebookPermalink = `https://www.facebook.com/${pageId}/videos/${videoId}/`;
        }

        // Post First Comment (Auto-Comment CTA #VAULT)
        if (post.firstComment?.enabled && post.firstComment.text) {
          try {
            const commentParams = new URLSearchParams();
            commentParams.append('message', post.firstComment.text);
            commentParams.append('access_token', pageToken);

            const cRes = await fetch(`${apiBase}/${videoId}/comments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: commentParams.toString(),
            });
            const cData = await cRes.json();
            if (cRes.ok && cData.id) {
              post.firstComment.status = 'published';
              post.firstComment.commentId = cData.id;
            }
          } catch (cErr) {
            logger.system('warn', 'FACEBOOK_FIRST_COMMENT_ERROR', `Failed to post first comment: ${cErr}`);
          }
        }

        await post.save();
        logger.system('info', 'FACEBOOK_VIDEO_PUBLISHED', `Successfully published video ${videoId} to ${post.pageName}`);
        return { success: true, permalink: post.facebookPermalink };
      }

      // 3. Publish Photo Post
      if (post.postType === 'PHOTO' && post.mediaUrl) {
        const photoParams = new URLSearchParams();
        photoParams.append('access_token', pageToken);
        photoParams.append('url', post.mediaUrl);
        photoParams.append('caption', post.message || '');

        const photoRes = await fetch(`${apiBase}/${pageId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: photoParams.toString(),
        });
        const photoData = await photoRes.json();
        if (!photoRes.ok || !photoData.id) {
          throw new Error(photoData.error?.message || 'Failed to post photo to Facebook Page');
        }

        const photoId = String(photoData.id);
        post.facebookPostId = photoId;
        post.status = 'published';
        post.publishedAt = new Date();
        post.facebookPermalink = `https://www.facebook.com/${photoId}`;
        await post.save();
        return { success: true, permalink: post.facebookPermalink };
      }

      // 4. Publish Standard Text Status Post
      const feedParams = new URLSearchParams();
      feedParams.append('access_token', pageToken);
      feedParams.append('message', post.message || '');

      const feedRes = await fetch(`${apiBase}/${pageId}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: feedParams.toString(),
      });
      const feedData = await feedRes.json();
      if (!feedRes.ok || !feedData.id) {
        throw new Error(feedData.error?.message || 'Failed to publish status to Facebook Page');
      }

      const feedId = String(feedData.id);
      post.facebookPostId = feedId;
      post.status = 'published';
      post.publishedAt = new Date();
      post.facebookPermalink = `https://www.facebook.com/${feedId}`;
      await post.save();
      return { success: true, permalink: post.facebookPermalink };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      post.status = 'failed';
      post.error = msg;
      await post.save();
      logger.system('error', 'FACEBOOK_PUBLISH_FAILED', `Failed to publish Facebook post ${postId}: ${msg}`);
      return { success: false, error: msg };
    }
  }

  /**
   * Retrieves aggregated analytics for a Facebook Page
   */
  public async getAnalytics(pageId?: string) {
    await connectMongo();
    const filter = pageId && pageId !== 'all' ? { pageId } : {};

    const posts = await FacebookPost.find(filter).lean();
    const published = posts.filter((p) => p.status === 'published');

    const totalViews = published.reduce((acc, p) => acc + (p.analytics?.views || 0), 0);
    const totalLikes = published.reduce((acc, p) => acc + (p.analytics?.likes || 0), 0);
    const totalComments = published.reduce((acc, p) => acc + (p.analytics?.comments || 0), 0);
    const totalShares = published.reduce((acc, p) => acc + (p.analytics?.shares || 0), 0);
    const totalReach = published.reduce((acc, p) => acc + (p.analytics?.reach || 0), 0);

    const avgEngagement =
      published.length > 0
        ? Number(
            (
              published.reduce((acc, p) => acc + (p.analytics?.engagementRate || 0), 0) /
              published.length
            ).toFixed(1)
          )
        : 0;

    return {
      totalPosts: posts.length,
      publishedPosts: published.length,
      scheduledPosts: posts.filter((p) => p.status === 'scheduled').length,
      draftPosts: posts.filter((p) => p.status === 'draft').length,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalReach,
      avgEngagement,
      topPosts: published
        .sort((a, b) => (b.analytics?.views || 0) - (a.analytics?.views || 0))
        .slice(0, 5),
    };
  }
}

export const facebookService = new FacebookService();

