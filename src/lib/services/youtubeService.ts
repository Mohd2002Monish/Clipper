import fs from 'fs';
import { google, youtube_v3 } from 'googleapis';
import { config } from '../config';
import { connectMongo } from '../db';
import { YouTubeAccount, IYouTubeAccountDocument } from '../../models/YouTubeAccount';
import { YouTubeUpload, IYouTubeUploadDocument } from '../../models/YouTubeUpload';
import { Job } from '../../models/Job';
import { Part } from '../../models/Part';
import { driveService } from './driveService';
import { encryptText, decryptText } from './crypto';
import { logger } from '../logger/logger';
import { Readable } from 'stream';

export interface UploadOptions {
  channelId: string;
  folderName: string;
  sourceType: 'drive' | 'local';
  localPath?: string;
  driveFileId?: string;
  title: string;
  description: string;
  tags?: string[];
  privacyStatus: 'public' | 'unlisted' | 'private';
  videoType: 'short' | 'long_form';
  isMadeForKids?: boolean;
  jobId?: string;
  partIndex?: number;
  partFilename?: string;
}

export class YouTubeService {
  /**
   * Generates Google OAuth2 URL requesting YouTube Upload & Read scopes
   */
  public getAuthUrl(redirectUri?: string): string {
    if (!config.googleClientId || !config.googleClientSecret) {
      throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not configured.');
    }

    const targetRedirectUri = redirectUri || config.googleRedirectUri;

    const oauth2Client = new google.auth.OAuth2(
      config.googleClientId,
      config.googleClientSecret,
      targetRedirectUri
    );

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent select_account',
      scope: [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state: JSON.stringify({ type: 'youtube', timestamp: Date.now() }),
    });
  }

  /**
   * Handles OAuth callback: exchanges code for tokens, retrieves channel info,
   * and saves or updates the YouTube account in MongoDB.
   */
  public async handleOAuthCallback(
    code: string,
    redirectUri?: string
  ): Promise<IYouTubeAccountDocument> {
    await connectMongo();

    const targetRedirectUri = redirectUri || config.googleRedirectUri;

    const oauth2Client = new google.auth.OAuth2(
      config.googleClientId,
      config.googleClientSecret,
      targetRedirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (!tokens.refresh_token) {
      // If prompt wasn't forced or re-authorized, check if we already have a token
      logger.system('warn', 'YOUTUBE_OAUTH_NO_REFRESH_TOKEN', 'No refresh token returned by Google OAuth');
    }

    // Retrieve YouTube Channel details
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const channelRes = await youtube.channels.list({
      part: ['snippet', 'statistics'],
      mine: true,
    });

    const channelItem = channelRes.data.items?.[0];
    if (!channelItem || !channelItem.id) {
      throw new Error('No YouTube channel found for this Google account. Please create a channel first.');
    }

    const channelId = channelItem.id;
    const channelTitle = channelItem.snippet?.title || 'YouTube Channel';
    const channelDescription = channelItem.snippet?.description || '';
    const channelCustomUrl = channelItem.snippet?.customUrl || '';
    const channelAvatarUrl =
      channelItem.snippet?.thumbnails?.high?.url ||
      channelItem.snippet?.thumbnails?.medium?.url ||
      channelItem.snippet?.thumbnails?.default?.url ||
      '';
    const subscriberCount = parseInt(channelItem.statistics?.subscriberCount || '0', 10);

    // Encrypt refresh token
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptText(tokens.refresh_token)
      : '';

    // Check if account already exists
    let account = await YouTubeAccount.findOne({ channelId });

    if (account) {
      account.channelTitle = channelTitle;
      account.channelDescription = channelDescription;
      account.channelCustomUrl = channelCustomUrl;
      account.channelAvatarUrl = channelAvatarUrl;
      account.subscriberCount = subscriberCount;
      account.isActive = true;
      if (encryptedRefreshToken) {
        account.encryptedRefreshToken = encryptedRefreshToken;
      }
      if (tokens.access_token) {
        account.accessToken = tokens.access_token;
      }
      if (tokens.expiry_date) {
        account.tokenExpiry = new Date(tokens.expiry_date);
      }
      await account.save();
    } else {
      if (!encryptedRefreshToken) {
        throw new Error('Failed to obtain offline refresh token. Please re-authenticate and approve all permissions.');
      }
      account = await YouTubeAccount.create({
        channelId,
        channelTitle,
        channelDescription,
        channelCustomUrl,
        channelAvatarUrl,
        subscriberCount,
        encryptedRefreshToken,
        accessToken: tokens.access_token,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        isActive: true,
      });
    }

    logger.system('info', 'YOUTUBE_ACCOUNT_LINKED', `Linked YouTube Channel "${channelTitle}" (${channelId})`);
    return account;
  }

  /**
   * Retrieves all connected YouTube accounts (without exposing encrypted tokens)
   */
  public async getAccounts() {
    await connectMongo();
    const accounts = await YouTubeAccount.find().sort({ createdAt: -1 }).lean();
    return accounts.map((acc) => ({
      _id: String(acc._id),
      channelId: acc.channelId,
      channelTitle: acc.channelTitle,
      channelDescription: acc.channelDescription,
      channelCustomUrl: acc.channelCustomUrl,
      channelAvatarUrl: acc.channelAvatarUrl,
      subscriberCount: acc.subscriberCount,
      isActive: acc.isActive,
      createdAt: acc.createdAt,
    }));
  }

  /**
   * Disconnects / removes a YouTube account
   */
  public async deleteAccount(channelId: string) {
    await connectMongo();
    await YouTubeAccount.deleteOne({ channelId });
    logger.system('info', 'YOUTUBE_ACCOUNT_REMOVED', `Removed YouTube channel ${channelId}`);
    return { success: true };
  }

  /**
   * Sets the active default channel
   */
  public async setActiveAccount(channelId: string) {
    await connectMongo();
    await YouTubeAccount.updateMany({}, { isActive: false });
    await YouTubeAccount.updateOne({ channelId }, { isActive: true });
    return { success: true };
  }

  /**
   * Returns an authorized YouTube v3 client for the given channel ID
   */
  public async getYouTubeClientForChannel(channelId: string): Promise<youtube_v3.Youtube> {
    await connectMongo();
    const account = await YouTubeAccount.findOne({ channelId });
    if (!account) {
      throw new Error(`YouTube account with channel ID ${channelId} not found.`);
    }

    const refreshToken = decryptText(account.encryptedRefreshToken);
    if (!refreshToken) {
      throw new Error(`No valid refresh token found for channel ${account.channelTitle}.`);
    }

    const oauth2Client = new google.auth.OAuth2(
      config.googleClientId,
      config.googleClientSecret,
      config.googleRedirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
      access_token: account.accessToken,
    });

    return google.youtube({ version: 'v3', auth: oauth2Client });
  }

  /**
   * Uploads a video from Google Drive or local storage directly to YouTube
   */
  public async uploadVideo(options: UploadOptions): Promise<IYouTubeUploadDocument> {
    await connectMongo();

    const account = await YouTubeAccount.findOne({ channelId: options.channelId });
    if (!account) {
      throw new Error(`YouTube channel with ID "${options.channelId}" is not connected.`);
    }

    // Auto-formatting for YouTube Shorts
    let finalTitle = options.title.trim();
    let finalDescription = (options.description || '').trim();

    if (options.videoType === 'short') {
      if (!finalTitle.toLowerCase().includes('#shorts')) {
        finalTitle = `${finalTitle} #Shorts`;
      }
      if (!finalDescription.toLowerCase().includes('#shorts')) {
        finalDescription = `${finalDescription}\n\n#Shorts #ShortsVideo`;
      }
    }

    const finalTags = options.tags && options.tags.length > 0
      ? options.tags
      : options.videoType === 'short'
      ? ['Shorts', 'YouTubeShorts', 'Video']
      : ['Video'];

    // Create a pending record in the database
    const uploadRecord = await YouTubeUpload.create({
      channelId: options.channelId,
      channelTitle: account.channelTitle,
      folderName: options.folderName,
      jobId: options.jobId,
      partIndex: options.partIndex,
      partFilename: options.partFilename,
      sourceType: options.sourceType,
      sourceId: options.driveFileId || options.localPath,
      title: finalTitle,
      description: finalDescription,
      tags: finalTags,
      privacyStatus: options.privacyStatus,
      videoType: options.videoType,
      isMadeForKids: options.isMadeForKids ?? false,
      status: 'uploading',
    });

    try {
      // Prepare the readable stream from either Google Drive or Local disk
      let videoStream: Readable;

      if (options.sourceType === 'drive' && options.driveFileId) {
        logger.system('info', 'YOUTUBE_FETCHING_DRIVE_STREAM', `Fetching media stream from Google Drive file: ${options.driveFileId}`);
        const drive = await driveService.getAuthenticatedDrive();
        if (!drive) {
          throw new Error('Google Drive client is not authenticated to read the file.');
        }

        const driveRes = await drive.files.get(
          { fileId: options.driveFileId, alt: 'media' },
          { responseType: 'stream' }
        );

        videoStream = driveRes.data as Readable;
      } else if (options.localPath && fs.existsSync(options.localPath)) {
        logger.system('info', 'YOUTUBE_FETCHING_LOCAL_STREAM', `Streaming local video file: ${options.localPath}`);
        videoStream = fs.createReadStream(options.localPath);
      } else if (options.driveFileId) {
        // Fallback to drive if local path does not exist
        const drive = await driveService.getAuthenticatedDrive();
        if (!drive) {
          throw new Error('Video file was not found locally and Google Drive is not connected.');
        }
        const driveRes = await drive.files.get(
          { fileId: options.driveFileId, alt: 'media' },
          { responseType: 'stream' }
        );
        videoStream = driveRes.data as Readable;
      } else {
        throw new Error('No valid video source file provided (neither valid local path nor Google Drive file ID).');
      }

      // Get authenticated YouTube client for this channel
      const youtube = await this.getYouTubeClientForChannel(options.channelId);

      logger.system(
        'info',
        'YOUTUBE_STARTING_INSERT',
        `Uploading video "${finalTitle}" (${options.videoType}) to YouTube channel "${account.channelTitle}"`
      );

      const youtubeRes = await youtube.videos.insert({
        part: ['snippet', 'status'],
        notifySubscribers: options.privacyStatus === 'public',
        requestBody: {
          snippet: {
            title: finalTitle,
            description: finalDescription,
            tags: finalTags,
            categoryId: '22', // People & Blogs
            defaultLanguage: 'en',
          },
          status: {
            privacyStatus: options.privacyStatus,
            selfDeclaredMadeForKids: options.isMadeForKids ?? false,
          },
        },
        media: {
          body: videoStream,
        },
      });

      const videoId = youtubeRes.data.id;
      if (!videoId) {
        throw new Error('YouTube API did not return a valid video ID.');
      }

      const youtubeUrl = `https://youtu.be/${videoId}`;

      uploadRecord.status = 'completed';
      uploadRecord.videoId = videoId;
      uploadRecord.youtubeUrl = youtubeUrl;
      uploadRecord.publishedAt = new Date();
      await uploadRecord.save();

      logger.system(
        'info',
        'YOUTUBE_UPLOAD_SUCCESS',
        `Video successfully published to YouTube: ${youtubeUrl} on channel "${account.channelTitle}"`
      );

      return uploadRecord;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.system('error', 'YOUTUBE_UPLOAD_ERROR', `Failed to upload to YouTube: ${errorMsg}`);
      uploadRecord.status = 'failed';
      uploadRecord.error = errorMsg;
      await uploadRecord.save();
      throw err;
    }
  }

  /**
   * Gets upload history from MongoDB
   */
  public async getUploadHistory(limit = 50) {
    await connectMongo();
    return YouTubeUpload.find().sort({ createdAt: -1 }).limit(limit).lean();
  }
}

export const youtubeService = new YouTubeService();
