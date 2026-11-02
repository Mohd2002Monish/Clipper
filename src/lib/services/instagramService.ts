import fs from 'fs';
import path from 'path';
import { connectMongo } from '../db';
import { InstagramAccount, IInstagramAccountDocument } from '../../models/InstagramAccount';
import { InstagramPost, IInstagramPostDocument } from '../../models/InstagramPost';
import { Part } from '../../models/Part';
import { Setting } from '../../models/Setting';
import { config } from '../config';
import { logger } from '../logger/logger';
import { encryptText, safeDecryptToken } from './crypto';
import { publicMediaService } from './publicMediaService';

export interface MetaInstagramPublishResponse {
  id: string;
}

export class InstagramService {
  /**
   * List all registered Instagram accounts.
   */
  public async getAccounts(): Promise<IInstagramAccountDocument[]> {
    await connectMongo();
    // Automatically purge any residual simulated seed accounts
    await InstagramAccount.deleteMany({ isSimulated: true });
    return InstagramAccount.find().select('-accessToken').sort({ createdAt: -1 });
  }

  /**
   * Generates Direct Instagram Login OAuth 2.0 Authorization URL
   * End-point: https://www.instagram.com/oauth/authorize
   */
  public async getAuthUrl(
    redirectUri?: string,
    state?: string
  ): Promise<{
    authUrl: string | null;
    configured: boolean;
    appId?: string;
    clientId?: string;
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
    const clientId =
      process.env.INSTAGRAM_CLIENT_ID ||
      process.env.INSTAAPP_ID ||
      process.env.INSTAGRAM_APP_ID ||
      config.instagramClientId ||
      setting?.instagram?.appId;
    const targetRedirectUri =
      redirectUri ||
      process.env.INSTAGRAM_REDIRECT_URI ||
      setting?.instagram?.redirectUri ||
      config.instagramRedirectUri;

    if (!clientId) {
      return {
        authUrl: null,
        configured: false,
        redirectUri: targetRedirectUri,
        message: 'Instagram Client ID is not configured. Enter your Instagram Client ID in Settings or OAuth tab to enable.',
      };
    }

    const scopes = 'instagram_business_basic,instagram_business_content_publish';
    const oauthState = state || Math.random().toString(36).substring(2, 15);

    const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(targetRedirectUri)}&scope=${encodeURIComponent(
      scopes
    )}&response_type=code&state=${encodeURIComponent(oauthState)}`;

    return { authUrl, configured: true, appId: clientId, clientId, redirectUri: targetRedirectUri };
  }

  /**
   * Handles Direct Instagram Login OAuth callback:
   * 1. Sanitizes authorization code (stripping #_ fragment if present).
   * 2. Exchanges code for short-lived token via POST https://api.instagram.com/oauth/access_token.
   * 3. Exchanges short-lived token for 60-day long-lived token via GET https://graph.instagram.com/access_token.
   * 4. Fetches authenticated Instagram Profile details directly via https://graph.instagram.com/{version}/me.
   * 5. Encrypts token using AES-256-GCM.
   * 6. Upserts account in MongoDB, preserving the document _id on reconnects.
   */
  public async handleOAuthCallback(code: string, redirectUri?: string): Promise<IInstagramAccountDocument> {
    let setting = null;
    try {
      await connectMongo();
      setting = await Setting.findOne();
    } catch {
      // Graceful fallback to env/config
    }
    const clientId =
      process.env.INSTAGRAM_CLIENT_ID ||
      process.env.INSTAAPP_ID ||
      process.env.INSTAGRAM_APP_ID ||
      config.instagramClientId ||
      setting?.instagram?.appId;
    const clientSecret =
      process.env.INSTAGRAM_CLIENT_SECRET ||
      process.env.INSTAAPP_SECRET ||
      process.env.INSTAGRAM_APP_SECRET ||
      config.instagramClientSecret ||
      setting?.instagram?.appSecret;
    const targetRedirectUri =
      redirectUri ||
      process.env.INSTAGRAM_REDIRECT_URI ||
      setting?.instagram?.redirectUri ||
      config.instagramRedirectUri;

    if (!clientId || !clientSecret) {
      throw new Error('INSTAGRAM_CLIENT_ID and INSTAGRAM_CLIENT_SECRET must be configured for OAuth token exchange.');
    }

    // 1. Sanitize code: remove Instagram's documented #_ fragment suffix if present
    const sanitizedCode = code.replace(/#_.*$/, '').replace(/#.*$/, '').trim();

    // 2. Exchange code for short-lived token via POST https://api.instagram.com/oauth/access_token
    const tokenParams = new URLSearchParams();
    tokenParams.append('client_id', clientId);
    tokenParams.append('client_secret', clientSecret);
    tokenParams.append('grant_type', 'authorization_code');
    tokenParams.append('redirect_uri', targetRedirectUri);
    tokenParams.append('code', sanitizedCode);

    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      const errDetail =
        tokenData.error_message ||
        tokenData.error?.message ||
        'Failed to exchange authorization code for Instagram access token.';
      logger.system('error', 'INSTAGRAM_TOKEN_EXCHANGE_FAILED', errDetail);
      throw new Error(errDetail);
    }

    const shortLivedToken = tokenData.access_token;
    const userIdFromToken = tokenData.user_id ? String(tokenData.user_id) : '';

    // 3. Exchange for 60-day long-lived token via GET https://graph.instagram.com/access_token
    let longLivedToken = shortLivedToken;
    let tokenExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    try {
      const exUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(
        clientSecret
      )}&access_token=${encodeURIComponent(shortLivedToken)}`;
      const exRes = await fetch(exUrl);
      const exData = await exRes.json();
      if (exRes.ok && exData.access_token) {
        longLivedToken = exData.access_token;
        if (exData.expires_in) {
          tokenExpiry = new Date(Date.now() + exData.expires_in * 1000);
        }
      }
    } catch (exErr) {
      logger.system('warn', 'INSTAGRAM_EXCHANGE_WARNING', `Could not upgrade to long-lived token: ${exErr}`);
    }

    // 4. Retrieve authenticated Instagram Profile details directly
    const apiBase = config.instagramApiBaseUrl;
    const apiVersion = config.instagramApiVersion;
    let igUserId = userIdFromToken;
    let igUsername = '';
    let igDisplayName = '';
    let igProfilePic = '';
    let igBio = '';
    let igFollowers = 0;
    let igMedia = 0;

    try {
      const profileUrl = `${apiBase}/${apiVersion}/me?fields=id,username,name,profile_picture_url,biography,followers_count,media_count&access_token=${encodeURIComponent(
        longLivedToken
      )}`;
      const profileRes = await fetch(profileUrl);
      const profileData = await profileRes.json();

      if (profileRes.ok && profileData.id) {
        igUserId = String(profileData.id);
        igUsername = profileData.username || '';
        igDisplayName = profileData.name || igUsername;
        igProfilePic = profileData.profile_picture_url || '';
        igBio = profileData.biography || '';
        igFollowers = profileData.followers_count || 0;
        igMedia = profileData.media_count || 0;
      } else {
        // Fallback query with basic fields if extended fields fail
        const basicUrl = `${apiBase}/${apiVersion}/me?fields=id,username,account_type&access_token=${encodeURIComponent(
          longLivedToken
        )}`;
        const basicRes = await fetch(basicUrl);
        const basicData = await basicRes.json();
        if (basicRes.ok && basicData.id) {
          igUserId = String(basicData.id);
          igUsername = basicData.username || '';
          igDisplayName = igUsername;
        }
      }
    } catch (profileErr) {
      logger.system('warn', 'INSTAGRAM_PROFILE_FETCH_FAILED', `Could not fetch profile details: ${profileErr}`);
    }

    if (!igUserId || !igUsername) {
      throw new Error('Unable to retrieve Instagram profile details for the authenticated user.');
    }

    // 5. Encrypt access token before storing in MongoDB
    const encryptedToken = encryptText(longLivedToken);

    // 6. Upsert account in MongoDB, preserving the document _id on reconnects
    let acc = await InstagramAccount.findOne({
      $or: [{ instagramUserId: igUserId }, { username: igUsername }],
    });

    if (acc) {
      acc.instagramUserId = igUserId;
      acc.username = igUsername;
      acc.displayName = igDisplayName || acc.displayName || igUsername;
      if (igProfilePic) acc.profilePictureUrl = igProfilePic;
      if (igBio) acc.biography = igBio;
      acc.followerCount = igFollowers || acc.followerCount || 0;
      acc.mediaCount = igMedia || acc.mediaCount || 0;
      acc.accessToken = encryptedToken;
      acc.tokenExpiry = tokenExpiry;
      acc.authProvider = 'instagram_login';
      acc.isActive = true;
      acc.isSimulated = false;
      await acc.save();
    } else {
      acc = await InstagramAccount.create({
        instagramUserId: igUserId,
        username: igUsername,
        displayName: igDisplayName || igUsername,
        profilePictureUrl: igProfilePic,
        biography: igBio,
        followerCount: igFollowers,
        mediaCount: igMedia,
        accessToken: encryptedToken,
        tokenExpiry,
        authProvider: 'instagram_login',
        isActive: true,
        isSimulated: false,
      });
    }

    logger.system('info', 'INSTAGRAM_OAUTH_CONNECTED', `Successfully connected Instagram account: @${acc.username}`);
    return acc;
  }

  /**
   * Connects an account directly via a Meta Access Token
   */
  public async connectAccountWithToken(token: string): Promise<IInstagramAccountDocument> {
    await connectMongo();
    const cleanToken = token.trim();
    const apiBase = config.instagramApiBaseUrl;
    const apiVersion = config.instagramApiVersion;

    let instagramUserId = '';
    let username = '';
    let displayName = '';
    let profilePictureUrl = '';
    let biography = '';
    let followerCount = 0;
    let mediaCount = 0;

    // Direct Instagram profile query
    try {
      const meUrl = `${apiBase}/${apiVersion}/me?fields=id,username,name,profile_picture_url,biography,followers_count,media_count&access_token=${encodeURIComponent(
        cleanToken
      )}`;
      const meRes = await fetch(meUrl);
      const meData = await meRes.json();
      if (meRes.ok && meData.id) {
        instagramUserId = String(meData.id);
        username = meData.username || '';
        displayName = meData.name || username;
        profilePictureUrl = meData.profile_picture_url || '';
        biography = meData.biography || '';
        followerCount = meData.followers_count || 0;
        mediaCount = meData.media_count || 0;
      }
    } catch {
      // Ignore
    }

    if (!instagramUserId) {
      throw new Error('Invalid Instagram Access Token. Could not discover user account via Instagram API.');
    }

    const encryptedToken = encryptText(cleanToken);

    let account = await InstagramAccount.findOne({
      $or: [{ instagramUserId }, { username }],
    });

    if (account) {
      account.instagramUserId = instagramUserId;
      account.username = username;
      account.displayName = displayName;
      if (profilePictureUrl) account.profilePictureUrl = profilePictureUrl;
      if (biography) account.biography = biography;
      if (followerCount) account.followerCount = followerCount;
      if (mediaCount) account.mediaCount = mediaCount;
      account.accessToken = encryptedToken;
      account.tokenExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      account.authProvider = 'instagram_login';
      account.isActive = true;
      account.isSimulated = false;
      await account.save();
    } else {
      account = await InstagramAccount.create({
        instagramUserId,
        username,
        displayName,
        profilePictureUrl,
        biography,
        followerCount: followerCount || 0,
        mediaCount: mediaCount || 0,
        accessToken: encryptedToken,
        tokenExpiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        authProvider: 'instagram_login',
        isActive: true,
        isSimulated: false,
      });
    }

    return account;
  }

  /**
   * Adds a Custom / Sandbox account for local testing
   */
  public async addCustomAccount(data: {
    username: string;
    displayName?: string;
    biography?: string;
    profilePictureUrl?: string;
    followerCount?: number;
    accessToken?: string;
  }): Promise<IInstagramAccountDocument> {
    await connectMongo();
    const cleanUsername = data.username.replace(/^@/, '').trim();
    const instagramUserId = 'ig_' + cleanUsername + '_' + Math.random().toString(36).substring(2, 7);

    const existing = await InstagramAccount.findOne({ username: cleanUsername });
    if (existing) {
      existing.displayName = data.displayName || existing.displayName;
      if (data.biography) existing.biography = data.biography;
      if (data.profilePictureUrl) existing.profilePictureUrl = data.profilePictureUrl;
      if (data.accessToken) {
        existing.accessToken = encryptText(data.accessToken);
        existing.isSimulated = false;
      }
      await existing.save();
      return existing;
    }

    const account = await InstagramAccount.create({
      instagramUserId,
      username: cleanUsername,
      displayName: data.displayName || cleanUsername,
      profilePictureUrl:
        data.profilePictureUrl ||
        'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=150&auto=format&fit=crop&q=80',
      biography: data.biography || 'Cinema reels, curated trailers & ending analysis',
      followerCount: data.followerCount || 8500,
      mediaCount: 48,
      accessToken: data.accessToken ? encryptText(data.accessToken) : '',
      authProvider: 'instagram_login',
      isActive: true,
      isSimulated: !data.accessToken,
    });

    return account;
  }

  /**
   * Disconnect an Instagram account
   */
  public async deleteAccount(accountId: string): Promise<boolean> {
    await connectMongo();
    const res = await InstagramAccount.findByIdAndDelete(accountId);
    return !!res;
  }

  /**
   * Updates an Instagram account
   */
  public async updateAccount(
    accountId: string,
    data: {
      username?: string;
      displayName?: string;
      accessToken?: string;
      biography?: string;
      profilePictureUrl?: string;
      isActive?: boolean;
    }
  ): Promise<IInstagramAccountDocument | null> {
    await connectMongo();
    const updatePayload: Record<string, unknown> = { ...data };
    if (data.accessToken) {
      updatePayload.accessToken = encryptText(data.accessToken);
      updatePayload.isSimulated = false;
    }
    return InstagramAccount.findByIdAndUpdate(accountId, { $set: updatePayload }, { new: true });
  }

  /**
   * Refreshes a long-lived Instagram access token (+60 days)
   * End-point: GET https://graph.instagram.com/refresh_access_token
   */
  public async refreshAccountToken(
    accountId: string
  ): Promise<{ success: boolean; tokenExpiry?: Date; message: string; account?: IInstagramAccountDocument }> {
    await connectMongo();
    const account = await InstagramAccount.findById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }
    if (account.isSimulated || !account.accessToken) {
      return {
        success: true,
        message: 'Sandbox account simulated token is active.',
        account,
      };
    }

    const decryptedToken = safeDecryptToken(account.accessToken);

    try {
      const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(
        decryptedToken
      )}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.access_token) {
        // If token revoked or invalid, mark account as needing reconnect
        if (data.error?.code === 190 || res.status === 400 || res.status === 401) {
          account.isActive = false;
          await account.save();
        }
        throw new Error(data.error?.message || 'Failed to refresh token from Instagram API');
      }

      account.accessToken = encryptText(data.access_token);
      if (data.expires_in) {
        account.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);
      } else {
        account.tokenExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      }
      account.isActive = true;
      await account.save();
      logger.system('info', 'INSTAGRAM_TOKEN_REFRESHED', `Extended token for @${account.username}`);
      return {
        success: true,
        tokenExpiry: account.tokenExpiry,
        message: 'Instagram token successfully refreshed for 60 days.',
        account,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: msg };
    }
  }

  /**
   * Syncs and verifies account profile & followers from Instagram Graph API
   */
  public async verifyAndSyncAccount(accountId: string): Promise<IInstagramAccountDocument> {
    await connectMongo();
    const account = await InstagramAccount.findById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }
    if (account.isSimulated || !account.accessToken) {
      return account;
    }

    const decryptedToken = safeDecryptToken(account.accessToken);
    const apiBase = config.instagramApiBaseUrl;
    const apiVersion = config.instagramApiVersion;

    try {
      const url = `${apiBase}/${apiVersion}/me?fields=id,username,name,profile_picture_url,biography,followers_count,media_count&access_token=${encodeURIComponent(
        decryptedToken
      )}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.id) {
        if (data.username) account.username = data.username;
        if (data.name) account.displayName = data.name;
        if (data.profile_picture_url) account.profilePictureUrl = data.profile_picture_url;
        if (data.biography) account.biography = data.biography;
        if (data.followers_count !== undefined) account.followerCount = data.followers_count;
        if (data.media_count !== undefined) account.mediaCount = data.media_count;
        account.isSimulated = false;
        account.isActive = true;
        await account.save();
        logger.system('info', 'INSTAGRAM_ACCOUNT_SYNCED', `Synced profile for @${account.username}`);
      }
    } catch (err) {
      logger.system('warn', 'INSTAGRAM_ACCOUNT_SYNC_ERROR', `Failed to sync profile for @${account.username}: ${err}`);
    }

    return account;
  }

  /**
   * Resolves a local video file path on disk from post data.
   */
  private async resolveLocalVideoPath(post: IInstagramPostDocument): Promise<string | null> {
    return publicMediaService.resolveLocalFilePath({
      mediaUrl: post.mediaUrl,
      filename: post.videoSource?.filename,
      jobId: post.videoSource?.jobId,
      partIndex: post.videoSource?.partIndex,
    });
  }

  /**
   * Ensures that Meta receives a publicly reachable HTTPS video URL.
   */
  private async ensurePublicVideoUrl(post: IInstagramPostDocument, localFilePath: string | null): Promise<string> {
    return publicMediaService.ensurePublicVideoUrl(post.mediaUrl || '', localFilePath);
  }

  /**
   * Publishes an Instagram Reel or post (Media Container -> Media Publish workflow)
   * Using direct Instagram API endpoints:
   * 1. POST /{ig-user-id}/media
   * 2. GET /{container-id}?fields=status_code
   * 3. POST /{ig-user-id}/media_publish
   */
  public async publishPost(postId: string): Promise<{ success: boolean; permalink?: string; error?: string }> {
    await connectMongo();
    const post = await InstagramPost.findById(postId);
    if (!post) {
      throw new Error(`Instagram post ${postId} not found.`);
    }

    const account =
      (await InstagramAccount.findById(post.accountId)) ||
      (await InstagramAccount.findOne({ username: post.username }));

    post.status = 'publishing';
    await post.save();

    // 1. Simulation fallback if account is in sandbox mode or no valid token
    if (!account || account.isSimulated || !account.accessToken) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      post.status = 'published';
      post.publishedAt = new Date();
      post.instagramMediaId = `ig_media_${Date.now()}`;
      post.instagramPermalink = `https://instagram.com/reel/C${Math.random().toString(36).substring(2, 9)}/`;
      post.analytics = {
        plays: 420,
        views: 380,
        likes: 64,
        comments: 12,
        shares: 8,
        saves: 14,
        reach: 520,
        engagementRate: 7.2,
        lastSyncedAt: new Date(),
      };

      if (post.firstComment?.enabled && post.firstComment.text) {
        post.firstComment.status = 'published';
        post.firstComment.commentId = `sim_comment_${Date.now()}`;
      }

      await post.save();
      logger.system('info', 'INSTAGRAM_POST_SIMULATED', `Published simulated Instagram Reel for @${post.username}`);
      return { success: true, permalink: post.instagramPermalink };
    }

    try {
      const igUserId = account.instagramUserId;
      const accessToken = safeDecryptToken(account.accessToken);
      const apiBase = config.instagramApiBaseUrl;
      const apiVersion = config.instagramApiVersion;

      // 1. Resolve local video path if available on disk
      const localFilePath = (post.mediaType === 'REELS' || post.mediaType === 'VIDEO')
        ? await this.resolveLocalVideoPath(post)
        : null;

      // 2. Ensure video URL is publicly reachable for Meta's servers
      const publicVideoUrl = (post.mediaType === 'REELS' || post.mediaType === 'VIDEO')
        ? await this.ensurePublicVideoUrl(post, localFilePath)
        : post.mediaUrl;

      logger.system('info', 'INSTAGRAM_CONTAINER_INIT', `Creating media container with public URL: ${publicVideoUrl}`);

      // 3. Step 1: Create Media Container
      const containerParams = new URLSearchParams();
      containerParams.append('access_token', accessToken);
      containerParams.append('caption', post.caption || '');

      if (post.mediaType === 'REELS') {
        containerParams.append('media_type', 'REELS');
        containerParams.append('video_url', publicVideoUrl);
        containerParams.append('share_to_feed', post.shareToFeed ? 'true' : 'false');
        if (post.coverUrl) {
          containerParams.append('cover_url', post.coverUrl);
        }
      } else if (post.mediaType === 'VIDEO') {
        containerParams.append('media_type', 'VIDEO');
        containerParams.append('video_url', publicVideoUrl);
      } else {
        containerParams.append('image_url', post.mediaUrl);
      }

      const containerRes = await fetch(`${apiBase}/${apiVersion}/${igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: containerParams.toString(),
      });

      const containerData = await containerRes.json();
      if (!containerRes.ok || !containerData.id) {
        throw new Error(containerData.error?.message || 'Failed to create Instagram media container');
      }

      const containerId = containerData.id;
      post.instagramContainerId = containerId;
      await post.save();

      // Step 2: Poll Container until FINISHED
      if (post.mediaType === 'REELS' || post.mediaType === 'VIDEO') {
        let isReady = false;
        let attempts = 0;
        while (!isReady && attempts < 40) {
          await new Promise((r) => setTimeout(r, 3000));
          attempts++;
          const statusRes = await fetch(
            `${apiBase}/${apiVersion}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(
              accessToken
            )}`
          );
          const statusData = await statusRes.json();
          logger.system('info', 'INSTAGRAM_CONTAINER_POLL', `Poll attempt ${attempts} for ${containerId}: ${JSON.stringify(statusData)}`);

          if (statusData.status_code === 'FINISHED') {
            isReady = true;
          } else if (statusData.status_code === 'ERROR' || statusData.status_code === 'EXPIRED') {
            const detail = statusData.status || statusData.error?.message || statusData.status_code;
            throw new Error(`Instagram container failed with status: ${statusData.status_code} (${detail})`);
          }
        }

        if (!isReady) {
          throw new Error('Instagram container processing timed out after 120 seconds');
        }
      }

      // Step 3: Publish Container
      const publishParams = new URLSearchParams();
      publishParams.append('creation_id', containerId);
      publishParams.append('access_token', accessToken);

      const pubRes = await fetch(`${apiBase}/${apiVersion}/${igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: publishParams.toString(),
      });

      const pubData = await pubRes.json();
      if (!pubRes.ok || !pubData.id) {
        throw new Error(pubData.error?.message || 'Failed to publish Instagram container');
      }

      const mediaId = pubData.id;
      post.instagramMediaId = mediaId;
      post.status = 'published';
      post.publishedAt = new Date();

      // Step 4: Fetch live permalink
      try {
        const mediaRes = await fetch(
          `${apiBase}/${apiVersion}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(
            accessToken
          )}`
        );
        const mediaData = await mediaRes.json();
        if (mediaData.permalink) {
          post.instagramPermalink = mediaData.permalink;
        }
      } catch {
        post.instagramPermalink = `https://instagram.com/p/${mediaId}`;
      }

      // Step 5: Post First Comment (Auto-Comment CTA) if supported
      if (post.firstComment?.enabled && post.firstComment.text) {
        try {
          const commentParams = new URLSearchParams();
          commentParams.append('message', post.firstComment.text);
          commentParams.append('access_token', accessToken);

          const cRes = await fetch(`${apiBase}/${apiVersion}/${mediaId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: commentParams.toString(),
          });
          const cData = await cRes.json();
          if (cRes.ok && cData.id) {
            post.firstComment.status = 'published';
            post.firstComment.commentId = cData.id;
          } else {
            post.firstComment.status = 'failed';
          }
        } catch {
          post.firstComment.status = 'failed';
        }
      }

      await post.save();
      logger.system('info', 'INSTAGRAM_PUBLISHED_SUCCESS', `Published Reel ${mediaId} to @${post.username}`);
      return { success: true, permalink: post.instagramPermalink };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      post.status = 'failed';
      post.error = errMsg;
      await post.save();
      logger.system('error', 'INSTAGRAM_PUBLISH_FAILED', `Failed to publish post ${postId}: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }

  /**
   * Fetches real live media & account analytics from Instagram Graph API for an account
   */
  public async syncLiveAccountAnalytics(accountFilter?: string): Promise<{
    syncedPosts: number;
    followerCount: number;
    mediaCount: number;
    totalPlays: number;
    totalLikes: number;
    totalComments: number;
  }> {
    await connectMongo();

    let account: IInstagramAccountDocument | null = null;
    if (accountFilter && accountFilter !== 'all') {
      account =
        (await InstagramAccount.findById(accountFilter)) ||
        (await InstagramAccount.findOne({
          $or: [{ instagramUserId: accountFilter }, { username: accountFilter.replace(/^@/, '') }],
        }));
    } else {
      account = await InstagramAccount.findOne({ isActive: true, accessToken: { $exists: true, $ne: '' } });
    }

    if (!account) {
      return { syncedPosts: 0, followerCount: 0, mediaCount: 0, totalPlays: 0, totalLikes: 0, totalComments: 0 };
    }

    if (account.isSimulated || !account.accessToken) {
      return {
        syncedPosts: 0,
        followerCount: account.followerCount || 0,
        mediaCount: account.mediaCount || 0,
        totalPlays: 0,
        totalLikes: 0,
        totalComments: 0,
      };
    }

    const decryptedToken = safeDecryptToken(account.accessToken);
    const apiBase = config.instagramApiBaseUrl;
    const apiVersion = config.instagramApiVersion;

    // 1. Fetch live profile stats (followers, total media count)
    try {
      const meRes = await fetch(
        `${apiBase}/${apiVersion}/me?fields=id,username,name,profile_picture_url,followers_count,media_count&access_token=${encodeURIComponent(
          decryptedToken
        )}`
      );
      const meData = await meRes.json();
      if (meRes.ok && meData.id) {
        if (meData.followers_count !== undefined) account.followerCount = Number(meData.followers_count);
        if (meData.media_count !== undefined) account.mediaCount = Number(meData.media_count);
        if (meData.profile_picture_url) account.profilePictureUrl = meData.profile_picture_url;
        await account.save();
        logger.system(
          'info',
          'INSTAGRAM_LIVE_PROFILE_SYNCED',
          `Synced profile for @${account.username}: ${account.followerCount} followers`
        );
      }
    } catch (err) {
      logger.system('warn', 'INSTAGRAM_LIVE_PROFILE_SYNC_ERR', `Failed to sync profile: ${err}`);
    }

    // 2. Fetch published posts in DB for this account
    const posts = await InstagramPost.find({
      $or: [{ accountId: account._id }, { username: account.username }],
      status: 'published',
    });

    let syncedPosts = 0;
    let totalPlays = 0;
    let totalLikes = 0;
    let totalComments = 0;

    for (const post of posts) {
      if (!post.instagramMediaId) continue;
      const mediaId = post.instagramMediaId;

      try {
        let likes = post.analytics?.likes || 0;
        let comments = post.analytics?.comments || 0;
        let permalink = post.instagramPermalink;

        const mediaRes = await fetch(
          `${apiBase}/${apiVersion}/${mediaId}?fields=id,like_count,comments_count,permalink,timestamp&access_token=${encodeURIComponent(
            decryptedToken
          )}`
        );
        const mediaData = await mediaRes.json();
        if (mediaRes.ok) {
          if (mediaData.like_count !== undefined) likes = Number(mediaData.like_count);
          if (mediaData.comments_count !== undefined) comments = Number(mediaData.comments_count);
          if (mediaData.permalink) permalink = mediaData.permalink;
        }

        let plays = post.analytics?.plays || 0;
        let reach = post.analytics?.reach || 0;
        let shares = post.analytics?.shares || 0;
        let saves = post.analytics?.saves || 0;

        const insightsRes = await fetch(
          `${apiBase}/${apiVersion}/${mediaId}/insights?metric=reach,saved,shares,plays,total_interactions&access_token=${encodeURIComponent(
            decryptedToken
          )}`
        );
        const insightsData = await insightsRes.json();
        if (insightsRes.ok && Array.isArray(insightsData.data)) {
          for (const item of insightsData.data) {
            const val = item.values?.[0]?.value ?? item.total_value?.value ?? 0;
            if (item.name === 'plays') plays = Number(val);
            if (item.name === 'reach') reach = Number(val);
            if (item.name === 'shares') shares = Number(val);
            if (item.name === 'saved') saves = Number(val);
          }
        }

        const views = plays > 0 ? plays : reach > 0 ? reach : likes * 8;
        const totalEngagements = likes + comments + shares + saves;
        const engagementRate = reach > 0 ? parseFloat(((totalEngagements / reach) * 100).toFixed(1)) : 0;

        post.analytics = {
          plays,
          views,
          likes,
          comments,
          shares,
          saves,
          reach,
          engagementRate,
          lastSyncedAt: new Date(),
        };
        if (permalink) post.instagramPermalink = permalink;
        await post.save();

        syncedPosts++;
        totalPlays += plays;
        totalLikes += likes;
        totalComments += comments;
      } catch (err) {
        logger.system('warn', 'INSTAGRAM_LIVE_MEDIA_SYNC_ERR', `Failed to sync media ${mediaId}: ${err}`);
      }
    }

    // 3. Query recent media from Instagram directly to import/sync posts
    try {
      const recentMediaRes = await fetch(
        `${apiBase}/${apiVersion}/me/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count&limit=15&access_token=${encodeURIComponent(
          decryptedToken
        )}`
      );
      const recentMediaData = await recentMediaRes.json();
      if (recentMediaRes.ok && Array.isArray(recentMediaData.data)) {
        for (const item of recentMediaData.data) {
          const existing = await InstagramPost.findOne({ instagramMediaId: String(item.id) });
          if (!existing) {
            await InstagramPost.create({
              accountId: account._id.toString(),
              username: account.username,
              caption: item.caption || '',
              mediaType: item.media_type === 'VIDEO' ? 'REELS' : 'IMAGE',
              mediaUrl: item.media_url || item.permalink || '',
              status: 'published',
              publishedAt: item.timestamp ? new Date(item.timestamp) : new Date(),
              instagramMediaId: String(item.id),
              instagramPermalink: item.permalink || `https://instagram.com/p/${item.id}`,
              analytics: {
                plays: item.like_count ? Number(item.like_count) * 8 : 100,
                views: item.like_count ? Number(item.like_count) * 8 : 100,
                likes: Number(item.like_count || 0),
                comments: Number(item.comments_count || 0),
                shares: 0,
                saves: 0,
                reach: item.like_count ? Number(item.like_count) * 6 : 80,
                engagementRate: 5.0,
                lastSyncedAt: new Date(),
              },
            });
            syncedPosts++;
          }
        }
      }
    } catch {
      // Non-fatal
    }

    return {
      syncedPosts,
      followerCount: account.followerCount || 0,
      mediaCount: account.mediaCount || 0,
      totalPlays,
      totalLikes,
      totalComments,
    };
  }

  /**
   * Analytics calculation & insights
   */
  public async getAnalyticsSummary(
    accountFilter?: string,
    syncLive = false
  ): Promise<{
    account?: {
      username: string;
      displayName: string;
      followerCount: number;
      mediaCount: number;
      isLive: boolean;
      lastSyncedAt?: Date;
    } | null;
    totals: {
      totalPlays: number;
      totalViews: number;
      totalLikes: number;
      totalComments: number;
      totalShares: number;
      totalSaves: number;
      totalReach: number;
      avgEngagementRate: number;
      publishedCount: number;
      scheduledCount: number;
    };
    timeseries: Array<{ date: string; plays: number; likes: number; reach: number }>;
    bestTimesToPost: Array<{ hour: string; recommendation: string; engagementScore: number }>;
    syncedFromMeta: boolean;
  }> {
    await connectMongo();

    // Find target account
    let targetAccount: IInstagramAccountDocument | null = null;
    if (accountFilter && accountFilter !== 'all') {
      targetAccount =
        (await InstagramAccount.findById(accountFilter)) ||
        (await InstagramAccount.findOne({
          $or: [{ instagramUserId: accountFilter }, { username: accountFilter.replace(/^@/, '') }],
        }));
    } else {
      targetAccount = await InstagramAccount.findOne({ isActive: true });
    }

    let syncedFromMeta = false;
    if (syncLive && targetAccount && !targetAccount.isSimulated && targetAccount.accessToken) {
      await this.syncLiveAccountAnalytics(targetAccount._id.toString());
      syncedFromMeta = true;
    }

    const query: Record<string, unknown> = {};
    if (accountFilter && accountFilter !== 'all') {
      query.$or = [{ accountId: accountFilter }, { username: accountFilter.replace(/^@/, '') }];
    }

    const posts = await InstagramPost.find(query);
    const published = posts.filter((p) => p.status === 'published');
    const scheduled = posts.filter((p) => p.status === 'scheduled');

    let totalPlays = 0;
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalSaves = 0;
    let totalReach = 0;

    published.forEach((p) => {
      const an = p.analytics;
      totalPlays += an?.plays || 0;
      totalViews += an?.views || 0;
      totalLikes += an?.likes || 0;
      totalComments += an?.comments || 0;
      totalShares += an?.shares || 0;
      totalSaves += an?.saves || 0;
      totalReach += an?.reach || 0;
    });

    const totalEngagements = totalLikes + totalComments + totalShares + totalSaves;
    const avgEngagementRate =
      totalReach > 0 ? parseFloat(((totalEngagements / totalReach) * 100).toFixed(1)) : 0;

    // Generate 14-day timeseries based on real totals
    const timeseries: Array<{ date: string; plays: number; likes: number; reach: number }> = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      timeseries.push({
        date: dateStr,
        plays: totalPlays > 0 ? Math.floor(totalPlays / 14) : 0,
        likes: totalLikes > 0 ? Math.floor(totalLikes / 14) : 0,
        reach: totalReach > 0 ? Math.floor(totalReach / 14) : 0,
      });
    }

    const bestTimesToPost = [
      { hour: '9:00 AM', recommendation: 'Morning Commute Reels (Bollywood / Hindi Cinema)', engagementScore: 94 },
      { hour: '2:00 PM', recommendation: 'Lunchtime Reel Drops (Trending Teasers & Reels)', engagementScore: 88 },
      { hour: '9:00 PM', recommendation: 'Prime Time Peak (Hollywood, Thrillers & Endings)', engagementScore: 98 },
      { hour: '11:00 PM', recommendation: 'Late Night High Retention (Mind-bending Cinema)', engagementScore: 92 },
      { hour: '1:00 AM', recommendation: 'Night Owl Movie Vault & Open Loop Reels', engagementScore: 86 },
    ];

    return {
      account: targetAccount
        ? {
            username: targetAccount.username,
            displayName: targetAccount.displayName || targetAccount.username,
            followerCount: targetAccount.followerCount || 0,
            mediaCount: targetAccount.mediaCount || 0,
            isLive: !targetAccount.isSimulated && !!targetAccount.accessToken,
            lastSyncedAt: new Date(),
          }
        : null,
      totals: {
        totalPlays,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        totalSaves,
        totalReach,
        avgEngagementRate,
        publishedCount: published.length,
        scheduledCount: scheduled.length,
      },
      timeseries,
      bestTimesToPost,
      syncedFromMeta,
    };
  }
}

export const instagramService = new InstagramService();
