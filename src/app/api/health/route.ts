import { NextResponse } from 'next/server';
import { getSystemHealth } from '@/lib/system';
import { checkMongoHealth } from '@/lib/db';
import { checkRedisHealth } from '@/lib/redis';
import { config } from '@/lib/config';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();

  try {
    const [systemInfo, mongoStatus, redisStatus] = await Promise.all([
      getSystemHealth(),
      checkMongoHealth(),
      checkRedisHealth(),
    ]);

    const isDriveConfigured = Boolean(config.googleClientId && config.googleClientSecret);

    const isHealthy =
      systemInfo.ffmpeg.available &&
      systemInfo.ffprobe.available &&
      mongoStatus.connected &&
      redisStatus.connected;

    const overallStatus = isHealthy ? 'healthy' : 'degraded';

    const healthData = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      environment: config.env,
      services: {
        ffmpeg: systemInfo.ffmpeg,
        ffprobe: systemInfo.ffprobe,
        mongo: mongoStatus,
        redis: redisStatus,
        disk: systemInfo.disk,
        googleDrive: {
          configured: isDriveConfigured,
          defaultFolderIdSet: Boolean(config.googleDefaultFolderId),
        },
      },
      system: {
        uptimeSeconds: systemInfo.uptimeSeconds,
        memory: systemInfo.memory,
        cpu: systemInfo.cpu,
      },
    };

    logger.app('info', 'HEALTH_CHECK', `Health check completed: ${overallStatus}`, {
      status: overallStatus,
      durationMs: healthData.durationMs,
    });

    return NextResponse.json(healthData, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('api', 'HEALTH_CHECK_FAILED', `Health check error: ${errorMsg}`, err);

    return NextResponse.json(
      {
        status: 'unhealthy',
        error: errorMsg,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
