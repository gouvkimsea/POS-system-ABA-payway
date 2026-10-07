import { Redis } from 'ioredis';
import { getEnvConfig } from '@pos/config';
import { logger } from '../logger/index.js';

const config = getEnvConfig();

export interface RedisHealth {
  status: 'connected' | 'in-memory-fallback' | 'disconnected';
  latencyMs?: number;
  error?: string;
}

// In-memory key-value fallback store when standalone Redis server is unavailable
class InMemoryCacheStore {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<'OK'> {
    let expiresAt: number | undefined;
    if (mode === 'EX' && typeof duration === 'number') {
      expiresAt = Date.now() + duration * 1000;
    }
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async ping(): Promise<'PONG'> {
    return 'PONG';
  }
}

let redisClient: Redis | null = null;
let isRedisAvailable = false;
const inMemoryFallback = new InMemoryCacheStore();

export function initRedis(): void {
  try {
    const client = new Redis(config.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      retryStrategy(times) {
        if (times > 3) {
          logger.warn('[Redis] Max connection retries reached. Using in-memory cache fallback.');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 1000);
      },
    });

    client.on('connect', () => {
      isRedisAvailable = true;
      logger.info('[Redis] Successfully connected to Redis instance');
    });

    client.on('error', (err) => {
      isRedisAvailable = false;
      logger.warn(
        { err: err.message },
        '[Redis] Server connection unavailable, operating in in-memory fallback mode',
      );
    });

    redisClient = client;

    // Attempt non-blocking connection
    client.connect().catch((_err) => {
      isRedisAvailable = false;
      logger.info('[Redis] Using in-memory fallback cache (no external Redis service detected)');
    });
  } catch (err: any) {
    isRedisAvailable = false;
    logger.warn(
      { err: err.message },
      '[Redis] Initialization exception, running in-memory fallback',
    );
  }
}

export async function checkRedisConnection(): Promise<RedisHealth> {
  const start = Date.now();
  if (redisClient && isRedisAvailable) {
    try {
      const pong = await redisClient.ping();
      if (pong === 'PONG') {
        return {
          status: 'connected',
          latencyMs: Date.now() - start,
        };
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Check fallback health
  await inMemoryFallback.ping();
  return {
    status: 'in-memory-fallback',
    latencyMs: Date.now() - start,
  };
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      // Ignore
    }
  }
}

export const cache = {
  async get(key: string): Promise<string | null> {
    if (redisClient && isRedisAvailable) {
      try {
        return await redisClient.get(key);
      } catch {
        // Fallback
      }
    }
    return inMemoryFallback.get(key);
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (redisClient && isRedisAvailable) {
      try {
        if (ttlSeconds) {
          await redisClient.set(key, value, 'EX', ttlSeconds);
          return;
        }
        await redisClient.set(key, value);
        return;
      } catch {
        // Fallback
      }
    }
    if (ttlSeconds) {
      await inMemoryFallback.set(key, value, 'EX', ttlSeconds);
    } else {
      await inMemoryFallback.set(key, value);
    }
  },

  async del(key: string): Promise<void> {
    if (redisClient && isRedisAvailable) {
      try {
        await redisClient.del(key);
        return;
      } catch {
        // Fallback
      }
    }
    await inMemoryFallback.del(key);
  },
};
