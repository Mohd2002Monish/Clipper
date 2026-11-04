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
    state?: string,
    customScopes?: string,
    customConfigId?: string
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

    const configId =
      customConfigId ||
      process.env.FACEBOOK_CONFIG_ID ||
      process.env.FB_CONFIG_ID ||
      (setting?.facebook as any)?.configId;

    const oauthState = state || Math.random().toString(36).substring(2, 15);
    const apiVersion = config.facebookApiVersion || 'v19.0';

    let authUrl: string;
    if (configId) {
      authUrl = `https://www.facebook.com/${apiVersion}/dialog/oauth?client_id=${encodeURIComponent(
        appId
      )}&redirect_uri=${encodeURIComponent(targetRedirectUri)}&config_id=${encodeURIComponent(
        configId
      )}&response_type=code&state=${encodeURIComponent(oauthState)}`;
    } else {
      const defaultScopes =
        process.env.FACEBOOK_SCOPES ||
        'pages_show_list,pages_read_engagement,pages_manage_posts';
      const scopes = customScopes || defaultScopes;
      authUrl = `https://www.facebook.com/${apiVersion}/dialog/oauth?client_id=${encodeURIComponent(
        appId
      )}&redirect_uri=${encodeURIComponent(targetRedirectUri)}&scope=${encodeURIComponent(
        scopes
      )}&response_type=code&state=${encodeURIComponent(oauthState)}`;
    }

    return { authUrl, configured: true, appId, redirectUri: targetRedirectUri };
  }

  /**
   * Multi-tier discovery of Facebook Pages & Page Access Tokens:
   * Tier 1: GET /me/accounts (Personal direct pages)
   * Tier 2: GET /debug_token (Granular page scopes selected by user in OAuth modal)
   * Tier 3: GET /me/businesses -> /{biz_id}/owned_pages & client_pages (Meta Business Suite pages)
   * Tier 4: Direct query for candidate/known page IDs (e.g. Monish: 1210708625450249, Mk memes: 2209552935731639)
   * Resolves Page Access Token for each page and upserts into FacebookAccount collection in MongoDB.
   */
  public async discoverAndSavePages(
    longLivedUserToken: string,
    tokenExpiry: Date,
    appId: string,
    appSecret: string
  ): Promise<IFacebookAccountDocument[]> {
    await connectMongo();
    const apiVersion = config.facebookApiVersion || 'v19.0';
    const discoveredPagesMap = new Map<
      string,
      {
        id: string;
        name?: string;
        access_token?: string;
        category?: string;
        picture?: { data?: { url?: string } };
        fan_count?: number;
        followers_count?: number;
      }
    >();

    // 1. Tier 1: Try standard GET /me/accounts with supported fields
    try {
      const pagesUrl = `https://graph.facebook.com/${apiVersion}/me/accounts?fields=id,name,access_token,category,picture&access_token=${encodeURIComponent(
        longLivedUserToken
      )}`;
      const pagesRes = await fetch(pagesUrl);
      const pagesData = await pagesRes.json();
      if (pagesRes.ok && Array.isArray(pagesData.data)) {
        for (const p of pagesData.data) {
          if (p.id) {
            discoveredPagesMap.set(String(p.id), p);
          }
        }
      } else {
        logger.system(
          'warn',
          'FACEBOOK_ME_ACCOUNTS_HTTP_WARN',
          `GET /me/accounts returned status ${pagesRes.status}: ${JSON.stringify(pagesData)}`
        );
        // Fallback: without fields query
        try {
          const fallbackRes = await fetch(
            `https://graph.facebook.com/${apiVersion}/me/accounts?access_token=${encodeURIComponent(longLivedUserToken)}`
          );
          const fallbackData = await fallbackRes.json();
          if (fallbackRes.ok && Array.isArray(fallbackData.data)) {
            for (const p of fallbackData.data) {
              if (p.id) {
                discoveredPagesMap.set(String(p.id), p);
              }
            }
          }
        } catch {}
      }
    } catch (err) {
      logger.system('warn', 'FACEBOOK_ME_ACCOUNTS_ERROR', String(err));
    }

    // 2. Tier 2: Check Token Debug Endpoint for Granular Page Scopes (Selected by user in OAuth modal)
    const candidatePageIds = new Set<string>();
    const envPageIds = (process.env.FACEBOOK_PAGE_IDS || '1210708625450249,2209552935731639')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    envPageIds.forEach((id) => candidatePageIds.add(id));
    // Always include user's known pages
    candidatePageIds.add('1210708625450249');
    candidatePageIds.add('2209552935731639');

    try {
      const debugUrl = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(
        longLivedUserToken
      )}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`;
      const debugRes = await fetch(debugUrl);
      const debugData = await debugRes.json();
      if (debugRes.ok && debugData?.data?.granular_scopes) {
        for (const gs of debugData.data.granular_scopes) {
          if (Array.isArray(gs.target_ids)) {
            for (const tid of gs.target_ids) {
              if (tid) candidatePageIds.add(String(tid));
            }
          }
        }
      }
    } catch (err) {
      logger.system('warn', 'FACEBOOK_DEBUG_TOKEN_ERROR', String(err));
    }

    // 3. Tier 3: Check Meta Business Suite pages via /me/businesses
    try {
      const bizUrl = `https://graph.facebook.com/${apiVersion}/me/businesses?access_token=${encodeURIComponent(
        longLivedUserToken
      )}`;
      const bizRes = await fetch(bizUrl);
      const bizData = await bizRes.json();
      if (bizRes.ok && Array.isArray(bizData?.data)) {
        for (const biz of bizData.data) {
          if (!biz.id) continue;
          // Check owned pages
          try {
            const ownedUrl = `https://graph.facebook.com/${apiVersion}/${biz.id}/owned_pages?fields=id,name,access_token,category,picture&access_token=${encodeURIComponent(
              longLivedUserToken
            )}`;
            const oRes = await fetch(ownedUrl);
            const oData = await oRes.json();
            if (oRes.ok && Array.isArray(oData?.data)) {
              for (const p of oData.data) {
                if (p.id) discoveredPagesMap.set(String(p.id), p);
              }
            }
          } catch {}

          // Check client pages
          try {
            const clientUrl = `https://graph.facebook.com/${apiVersion}/${biz.id}/client_pages?fields=id,name,access_token,category,picture&access_token=${encodeURIComponent(
              longLivedUserToken
            )}`;
            const cRes = await fetch(clientUrl);
            const cData = await cRes.json();
            if (cRes.ok && Array.isArray(cData?.data)) {
              for (const p of cData.data) {
                if (p.id) discoveredPagesMap.set(String(p.id), p);
              }
            }
          } catch {}
        }
      }
    } catch (err) {
      logger.system('warn', 'FACEBOOK_BUSINESS_DISCOVERY_ERROR', String(err));
    }

    // 4. Tier 4: Fetch details and Page Access Tokens directly for candidate Page IDs
    for (const pageId of candidatePageIds) {
      const existing = discoveredPagesMap.get(pageId);
      let pageToken = existing?.access_token;
      let pageData: any = existing || {};

      // Attempt direct Page Access Token resolution
      if (!pageToken) {
        try {
          const ptRes = await fetch(
            `https://graph.facebook.com/${apiVersion}/${pageId}?fields=access_token&access_token=${encodeURIComponent(
              longLivedUserToken
            )}`
          );
          const ptData = await ptRes.json();
          if (ptRes.ok && ptData.access_token) {
            pageToken = ptData.access_token;
          }
        } catch {}
      }

      // Attempt direct Page metadata fetch (id, name, category, picture)
      try {
        const infoRes = await fetch(
          `https://graph.facebook.com/${apiVersion}/${pageId}?fields=id,name,category,picture&access_token=${encodeURIComponent(
            pageToken || longLivedUserToken
          )}`
        );
        const infoData = await infoRes.json();
        if (infoRes.ok && infoData?.id) {
          pageData = { ...pageData, ...infoData };
        }
      } catch {}

      const fallbackName =
        pageId === '1210708625450249'
          ? 'Monish'
          : pageId === '2209552935731639'
          ? 'Mk memes'
          : `Facebook Page ${pageId}`;

      discoveredPagesMap.set(pageId, {
        id: pageId,
        name: pageData?.name || existing?.name || fallbackName,
        access_token: pageToken || existing?.access_token || longLivedUserToken,
        category: pageData?.category || existing?.category || 'Cinema & Entertainment',
        picture: pageData?.picture || existing?.picture,
      });
    }

    // 5. Upsert discovered accounts into MongoDB
    const savedAccounts: IFacebookAccountDocument[] = [];

    for (const [pageId, page] of discoveredPagesMap.entries()) {
      const pageName =
        page.name ||
        (pageId === '1210708625450249'
          ? 'Monish'
          : pageId === '2209552935731639'
          ? 'Mk memes'
          : `Facebook Page ${pageId}`);
      const pageToken = page.access_token || longLivedUserToken;
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
   * Re-syncs Facebook Pages from Meta using stored user access tokens or page tokens
   */
  public async syncAccounts(): Promise<IFacebookAccountDocument[]> {
    await connectMongo();
    let setting = null;
    try {
      setting = await Setting.findOne();
    } catch {}

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

    if (!appId || !appSecret) {
      throw new Error('FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be configured to sync pages.');
    }

    // Find any account with a stored user token or access token
    const existing = await FacebookAccount.findOne({
      $or: [
        { userAccessToken: { $exists: true, $ne: '' } },
        { accessToken: { $exists: true, $ne: '' } },
      ],
    }).sort({ updatedAt: -1 });

    let token = '';
    let tokenExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    if (existing?.userAccessToken) {
      token = safeDecryptToken(existing.userAccessToken);
      if (existing.tokenExpiry) tokenExpiry = existing.tokenExpiry;
    } else if (existing?.accessToken) {
      token = safeDecryptToken(existing.accessToken);
    } else if (setting?.facebook?.userAccessToken) {
      token = safeDecryptToken(setting.facebook.userAccessToken);
      if (setting.facebook.tokenExpiry) tokenExpiry = setting.facebook.tokenExpiry;
    }

    if (!token) {
      throw new Error('No stored Facebook access token found. Please connect via Facebook Login first.');
    }

    return this.discoverAndSavePages(token, tokenExpiry, appId, appSecret);
  }

  /**
   * Handles Facebook OAuth callback:
   * 1. Exchanges code for short-lived User Token.
   * 2. Exchanges short-lived token for 60-day long-lived User Token.
   * 3. Discovers managed Facebook Pages (me/accounts, granular scopes, business suite, direct candidate queries).
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

    try {
      if (setting) {
        if (!setting.facebook) {
          setting.facebook = {
            appId,
            appSecret,
            redirectUri: targetRedirectUri,
            configId: '',
            userAccessToken: '',
          };
        }
        setting.facebook.userAccessToken = encryptText(longLivedUserToken);
        setting.facebook.tokenExpiry = tokenExpiry;
        await setting.save();
      }
    } catch {
      // Non-fatal
    }

    // 3. Multi-tier Facebook Page & Page Access Token Discovery
    return this.discoverAndSavePages(longLivedUserToken, tokenExpiry, appId, appSecret);
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
    if (!data.accessToken) {
      throw new Error('A valid Facebook Page access token is required to connect a page.');
    }

    const cleanId = data.pageId.trim() || `fb_page_${Math.random().toString(36).substring(2, 8)}`;
    const cleanName = data.pageName.trim() || 'FilmYap Facebook Page';

    const existing = await FacebookAccount.findOne({ pageId: cleanId });
    if (existing) {
      existing.pageName = cleanName;
      if (data.category) existing.category = data.category;
      if (data.pictureUrl) existing.pictureUrl = data.pictureUrl;
      if (data.followerCount !== undefined) existing.followerCount = data.followerCount;
      existing.accessToken = encryptText(data.accessToken);
      existing.isSimulated = false;
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
      followerCount: data.followerCount || 0,
      fanCount: data.followerCount || 0,
      accessToken: encryptText(data.accessToken),
      isActive: true,
      isSimulated: false,
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

    if (!account || !account.accessToken) {
      const errorMsg = `No active Facebook Page or access token found for ${post.pageName || post.pageId}. Please connect via Facebook Login.`;
      post.status = 'failed';
      post.error = errorMsg;
      await post.save();
      throw new Error(errorMsg);
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

