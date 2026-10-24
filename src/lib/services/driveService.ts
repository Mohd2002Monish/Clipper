import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { google, drive_v3 } from 'googleapis';
import { config } from '../config';
import { Setting } from '../../models/Setting';
import { connectMongo } from '../db';
import { encryptText, decryptText } from './crypto';
import { logger } from '../logger/logger';

export interface DriveUploadOptions {
  filePath: string;
  filename: string;
  folderId: string;
  onConflict?: 'rename' | 'overwrite' | 'skip';
  jobId?: string;
  partIndex?: number;
  onProgress?: (progressPercent: number) => void;
}

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
  checksum?: string;
  sizeBytes: number;
}

export class DriveService {
  /**
   * Generates the OAuth2 Authorization URL
   */
  public getAuthUrl(): string {
    if (!config.googleClientId || !config.googleClientSecret) {
      throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not configured.');
    }

    const oauth2Client = new google.auth.OAuth2(
      config.googleClientId,
      config.googleClientSecret,
      config.googleRedirectUri
    );

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    });
  }

  /**
   * Exchanges authorization code for refresh & access tokens
   */
  public async handleOAuthCallback(code: string): Promise<{ email?: string; folderId?: string }> {
    await connectMongo();

    const oauth2Client = new google.auth.OAuth2(
      config.googleClientId,
      config.googleClientSecret,
      config.googleRedirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    let userEmail: string | undefined;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      userEmail = userInfo.data.email || undefined;
    } catch {
      // Non-fatal if userinfo fails
    }

    let setting = await Setting.findOne();
    if (!setting) {
      setting = new Setting();
    }

    if (tokens.refresh_token) {
      setting.googleDrive.encryptedRefreshToken = encryptText(tokens.refresh_token);
    }
    setting.googleDrive.connected = true;
    setting.googleDrive.authType = 'oauth';
    if (userEmail) setting.googleDrive.userEmail = userEmail;
    setting.googleDrive.lastTestedAt = new Date().toISOString();

    await setting.save();
    logger.drive('info', 'DRIVE_OAUTH_CONNECTED', `Google Drive connected for ${userEmail || 'user'}`);

    return { email: userEmail, folderId: setting.googleDrive.folderId };
  }

  /**
   * Returns an authenticated Drive v3 client
   */
  public async getAuthenticatedDrive(): Promise<drive_v3.Drive | null> {
    await connectMongo();
    const setting = await Setting.findOne();

    // 1. Try Service Account if configured
    if (setting?.googleDrive?.authType === 'service_account' && setting.googleDrive.encryptedServiceAccountJson) {
      try {
        const jsonStr = decryptText(setting.googleDrive.encryptedServiceAccountJson);
        const credentials = JSON.parse(jsonStr);
        const auth = new google.auth.JWT({
          email: credentials.client_email,
          key: credentials.private_key,
          scopes: ['https://www.googleapis.com/auth/drive'],
        });
        return google.drive({ version: 'v3', auth });
      } catch (err) {
        logger.drive('error', 'SERVICE_ACCOUNT_AUTH_FAILED', `Failed to decrypt service account: ${err}`);
      }
    }

    // 2. Try OAuth refresh token from DB or fallback env
    let refreshToken: string | undefined;
    if (setting?.googleDrive?.encryptedRefreshToken) {
      try {
        refreshToken = decryptText(setting.googleDrive.encryptedRefreshToken);
      } catch (err) {
        logger.drive('error', 'TOKEN_DECRYPT_FAILED', `Failed to decrypt refresh token: ${err}`);
      }
    }

    if (!refreshToken && process.env.GOOGLE_REFRESH_TOKEN) {
      refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    }

    if (!refreshToken || !config.googleClientId || !config.googleClientSecret) {
      return null;
    }

    const oauth2Client = new google.auth.OAuth2(
      config.googleClientId,
      config.googleClientSecret,
      config.googleRedirectUri
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  /**
   * Tests connection to Google Drive and verifies folder write permissions
   */
  public async testConnection(folderIdInput?: string): Promise<{
    success: boolean;
    folderName?: string;
    folderId?: string;
    userEmail?: string;
    error?: string;
  }> {
    try {
      await connectMongo();
      const setting = await Setting.findOne();
      const drive = await this.getAuthenticatedDrive();

      if (!drive) {
        return {
          success: false,
          error: 'Google Drive is not authenticated. Please connect account or provide credentials.',
        };
      }

      const targetFolderId = folderIdInput || setting?.googleDrive?.folderId || config.googleDefaultFolderId || 'root';

      // 1. Check folder existence and metadata
      let folderName = 'Root Directory';
      if (targetFolderId !== 'root') {
        const folderRes = await drive.files.get({
          fileId: targetFolderId,
          fields: 'id, name, mimeType, capabilities',
          supportsAllDrives: true,
        });

        if (folderRes.data.mimeType !== 'application/vnd.google-apps.folder') {
          return {
            success: false,
            error: `Target ID "${targetFolderId}" is not a folder (mimeType: ${folderRes.data.mimeType}).`,
          };
        }

        folderName = folderRes.data.name || targetFolderId;

        if (folderRes.data.capabilities && !folderRes.data.capabilities.canAddChildren) {
          return {
            success: false,
            error: `Write permission denied for folder "${folderName}". Please ensure edit rights are granted.`,
          };
        }
      }

      // 2. Perform write probe check
      const probeName = `.probe_write_${Date.now()}.tmp`;
      const testFile = await drive.files.create({
        requestBody: {
          name: probeName,
          parents: [targetFolderId],
          description: 'VideoTimmer temporary write probe',
        },
        supportsAllDrives: true,
        fields: 'id',
      });

      // Cleanup probe
      if (testFile.data.id) {
        await drive.files.delete({
          fileId: testFile.data.id,
          supportsAllDrives: true,
        }).catch(() => {});
      }

      // Update setting test status
      if (setting) {
        setting.googleDrive.connected = true;
        setting.googleDrive.folderId = targetFolderId;
        setting.googleDrive.folderName = folderName;
        setting.googleDrive.lastTestedAt = new Date().toISOString();
        await setting.save();
      }

      logger.drive('info', 'DRIVE_TEST_SUCCESS', `Verified write access to folder: ${folderName} (${targetFolderId})`);

      return {
        success: true,
        folderName,
        folderId: targetFolderId,
        userEmail: setting?.googleDrive?.userEmail,
      };
    } catch (err: unknown) {
      let errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('Google Drive API has not been used in project') || errorMsg.includes('is disabled')) {
        // Keep the direct enable URL from Google
      } else if (errorMsg.toLowerCase().includes('insufficient permission') || errorMsg.includes('403')) {
        errorMsg = 'Insufficient Permission: Google Drive rejected write access. Please click "Reconnect Account" to grant Drive access. If using a specific target folder, verify your Google account has Editor access to it.';
      }
      logger.drive('error', 'DRIVE_TEST_FAILED', errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Ensures a subfolder exists inside parent folder, creates it if missing
   */
  public async ensureSubfolder(parentFolderId: string, subfolderName: string): Promise<string> {
    const drive = await this.getAuthenticatedDrive();
    if (!drive) {
      throw new Error('Google Drive is not authenticated.');
    }

    const safeName = subfolderName.replace(/'/g, "\\'");
    const query = `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}' and trashed = false`;

    const searchRes = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (searchRes.data.files && searchRes.data.files.length > 0) {
      return searchRes.data.files[0].id!;
    }

    const createdFolder = await drive.files.create({
      requestBody: {
        name: subfolderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });

    return createdFolder.data.id!;
  }

  /**
   * Calculates local file MD5 checksum
   */
  private computeMd5(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * Resumable upload of video file to Google Drive with retries & validation
   */
  public async uploadFile(options: DriveUploadOptions): Promise<DriveUploadResult> {
    const { filePath, folderId, onConflict = 'rename', jobId, partIndex } = options;
    let targetFilename = options.filename;

    if (!fs.existsSync(filePath)) {
      throw new Error(`File to upload does not exist: ${filePath}`);
    }

    const drive = await this.getAuthenticatedDrive();
    if (!drive) {
      throw new Error('Google Drive not configured or authenticated.');
    }

    const stat = fs.statSync(filePath);
    const expectedSize = stat.size;
    const expectedMd5 = await this.computeMd5(filePath);

    logger.drive(
      'info',
      'UPLOAD_START',
      `Starting Drive upload for "${targetFilename}" (${(expectedSize / (1024 * 1024)).toFixed(1)} MB)`,
      jobId,
      partIndex
    );

    // 1. Conflict handling
    const safeName = targetFilename.replace(/'/g, "\\'");
    const existingRes = await drive.files.list({
      q: `'${folderId}' in parents and name = '${safeName}' and trashed = false`,
      fields: 'files(id, name, webViewLink, size, md5Checksum)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const existingFile = existingRes.data.files && existingRes.data.files[0];
    if (existingFile) {
      if (onConflict === 'skip') {
        logger.drive('info', 'UPLOAD_SKIPPED', `File "${targetFilename}" already exists; skipping upload`, jobId, partIndex);
        return {
          fileId: existingFile.id!,
          webViewLink: existingFile.webViewLink || `https://drive.google.com/file/d/${existingFile.id}/view`,
          checksum: existingFile.md5Checksum || undefined,
          sizeBytes: Number(existingFile.size) || expectedSize,
        };
      } else if (onConflict === 'rename') {
        const ext = path.extname(targetFilename);
        const nameWithoutExt = path.basename(targetFilename, ext);
        targetFilename = `${nameWithoutExt} (${Date.now().toString().slice(-4)})${ext}`;
      }
    }

    // 2. Perform upload with exponential backoff retry
    const maxAttempts = 3;
    let lastError: Error | unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        let uploadRes;
        const media = {
          mimeType: 'video/mp4',
          body: fs.createReadStream(filePath),
        };

        if (existingFile && onConflict === 'overwrite') {
          uploadRes = await drive.files.update({
            fileId: existingFile.id!,
            media,
            fields: 'id, name, webViewLink, size, md5Checksum',
            supportsAllDrives: true,
          });
        } else {
          uploadRes = await drive.files.create({
            requestBody: {
              name: targetFilename,
              parents: [folderId],
            },
            media,
            fields: 'id, name, webViewLink, size, md5Checksum',
            supportsAllDrives: true,
          });
        }

        const uploadedData = uploadRes.data;
        const fileId = uploadedData.id!;
        const webViewLink =
          uploadedData.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

        // 3. Post-upload verification (size & checksum comparison)
        const uploadedSize = Number(uploadedData.size);
        if (uploadedSize && Math.abs(uploadedSize - expectedSize) > 1024) {
          throw new Error(
            `Upload size mismatch: local was ${expectedSize} bytes, Drive recorded ${uploadedSize} bytes.`
          );
        }

        if (uploadedData.md5Checksum && uploadedData.md5Checksum.toLowerCase() !== expectedMd5.toLowerCase()) {
          throw new Error(
            `Upload MD5 checksum mismatch: local was ${expectedMd5}, Drive recorded ${uploadedData.md5Checksum}.`
          );
        }

        logger.drive(
          'info',
          'UPLOAD_VERIFIED',
          `Drive upload verified successfully: ${targetFilename} (ID: ${fileId})`,
          jobId,
          partIndex
        );

        return {
          fileId,
          webViewLink,
          checksum: uploadedData.md5Checksum || expectedMd5,
          sizeBytes: uploadedSize || expectedSize,
        };
      } catch (err: unknown) {
        lastError = err;
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.drive(
          'warn',
          'UPLOAD_ATTEMPT_FAILED',
          `Drive upload attempt ${attempt}/${maxAttempts} failed: ${errorMsg}`,
          jobId,
          partIndex
        );

        if (attempt < maxAttempts) {
          // Exponential backoff: 2s, 4s
          await new Promise((res) => setTimeout(res, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error(`Upload failed after ${maxAttempts} attempts.`);
  }
}

export const driveService = new DriveService();
