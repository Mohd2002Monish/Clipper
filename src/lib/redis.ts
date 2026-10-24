import Redis from 'ioredis';
import { config } from './config';
import { logger } from './logger/logger';

declare global {
  // eslint-disable-next-line no-var
  var redisClient: Redis | undefined;
}

export function getRedisClient(): Redis {
  if (!global.redisClient) {
    const client = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      family: 4,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 3000);
        return delay;
      },
    });

    client.on('connect', () => {
      logger.system('info', 'REDIS_CONNECTED', 'Successfully connected to Redis');
    });

    client.on('error', (err) => {
      logger.system('warn', 'REDIS_ERROR', `Redis client notice: ${err.message}`);
    });

    global.redisClient = client;
  }

  return global.redisClient;
}

export async function checkRedisHealth(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    const client = getRedisClient();
    const pong = await client.ping();
    const latency = Date.now() - start;
    return {
      connected: pong === 'PONG',
      latencyMs: latency,
    };
  } catch (err: unknown) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
