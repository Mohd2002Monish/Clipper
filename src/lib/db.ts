import mongoose from 'mongoose';
import dns from 'dns';
import { config } from './config';
import { logger } from './logger/logger';

// Ensure reliable SRV DNS lookup for MongoDB Atlas on macOS
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Graceful fallback
}

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

const ATLAS_DIRECT_FALLBACK_URI =
  'mongodb://mohd_monish:4oEd26IBZuo4qRkx@ac-m6raov9-shard-00-00.3hnqz7n.mongodb.net:27017,ac-m6raov9-shard-00-01.3hnqz7n.mongodb.net:27017,ac-m6raov9-shard-00-02.3hnqz7n.mongodb.net:27017/jobs?ssl=true&replicaSet=atlas-vrzmm2-shard-0&authSource=admin&retryWrites=true&w=majority';

export async function connectMongo(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    };

    let targetUri = config.mongoUri;
    // If mongoUri contains the known SRV cluster, prefer direct replica set hosts to avoid router DNS SRV issues
    if (targetUri.includes('mongodb+srv://') && targetUri.includes('cluster0.3hnqz7n.mongodb.net')) {
      targetUri = ATLAS_DIRECT_FALLBACK_URI;
    }

    logger.system('info', 'MONGO_CONNECTING', `Connecting to MongoDB...`);

    cached.promise = mongoose
      .connect(targetUri, opts)
      .then((m) => {
        logger.system('info', 'MONGO_CONNECTED', 'Successfully connected to MongoDB');
        return m;
      })
      .catch(async (err) => {
        // Automatic fallback to direct replica set hosts if SRV lookup failed
        if (
          (err.message?.includes('querySrv') || err.message?.includes('ECONNREFUSED')) &&
          targetUri !== ATLAS_DIRECT_FALLBACK_URI
        ) {
          logger.system('warn', 'MONGO_SRV_FALLBACK', 'SRV lookup failed. Falling back to direct replica set hosts...');
          try {
            const fallbackConn = await mongoose.connect(ATLAS_DIRECT_FALLBACK_URI, opts);
            logger.system('info', 'MONGO_CONNECTED', 'Successfully connected to MongoDB via direct replica set hosts');
            return fallbackConn;
          } catch (fallbackErr: any) {
            logger.system('error', 'MONGO_CONNECT_FAILED', `MongoDB fallback connection failed: ${fallbackErr.message}`);
            cached.promise = null;
            throw fallbackErr;
          }
        }

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
