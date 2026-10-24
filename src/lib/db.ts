import mongoose from 'mongoose';
import { config } from './config';
import { logger } from './logger/logger';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };
if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectMongo(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    };

    logger.system('info', 'MONGO_CONNECTING', `Connecting to MongoDB at ${config.mongoUri}`);

    cached.promise = mongoose.connect(config.mongoUri, opts).then((m) => {
      logger.system('info', 'MONGO_CONNECTED', 'Successfully connected to MongoDB');
      return m;
    }).catch((err) => {
      logger.system('error', 'MONGO_CONNECT_FAILED', `MongoDB connection failed: ${err.message}`, { err });
      cached.promise = null;
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
}

export async function checkMongoHealth(): Promise<{ connected: boolean; error?: string }> {
  try {
    const client = await connectMongo();
    const state = client.connection.readyState;
    // 1 = connected
    return {
      connected: state === 1,
      error: state === 1 ? undefined : `MongoDB state is ${state}`,
    };
  } catch (err: unknown) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
