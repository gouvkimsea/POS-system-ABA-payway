import { cache } from '../../redis/index.js';
import { logger } from '../../logger/index.js';

interface MemoryLockEntry {
  lockedUntil: number;
}

interface MemoryCacheEntry {
  data: any;
  expiresAt: number;
}

export class IdempotencyManager {
  private static memoryLocks = new Map<string, MemoryLockEntry>();
  private static memoryCache = new Map<string, MemoryCacheEntry>();

  /**
   * Attempt to acquire an execution lock for the given idempotency key.
   * Returns true if lock was acquired, false if a concurrent execution is already in flight.
   */
  public static async acquireLock(key: string, ttlSeconds = 15): Promise<boolean> {
    if (!key) return true;

    const lockKey = `idemp_lock:${key}`;

    try {
      const existing = await cache.get(lockKey);
      if (existing) {
        return false;
      }
      await cache.set(lockKey, '1', ttlSeconds);
      return true;
    } catch (err) {
      logger.warn(`[IdempotencyManager] Cache lock check failed, using in-memory lock: ${err}`);
    }

    // In-memory fallback
    const now = Date.now();
    const existing = this.memoryLocks.get(lockKey);

    if (existing && existing.lockedUntil > now) {
      return false; // Still locked
    }

    this.memoryLocks.set(lockKey, { lockedUntil: now + ttlSeconds * 1000 });
    return true;
  }

  /**
   * Release the lock once processing finishes or fails
   */
  public static async releaseLock(key: string): Promise<void> {
    if (!key) return;

    const lockKey = `idemp_lock:${key}`;

    try {
      await cache.del(lockKey);
    } catch {
      // Ignore cleanup error
    }

    this.memoryLocks.delete(lockKey);
  }

  /**
   * Retrieve cached result for an idempotency key if previously completed
   */
  public static async getCompletedResult<T = any>(key: string): Promise<T | null> {
    if (!key) return null;

    const cacheKey = `idemp_result:${key}`;

    try {
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn(`[IdempotencyManager] Cache get failed, checking in-memory cache: ${err}`);
    }

    const entry = this.memoryCache.get(cacheKey);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data as T;
    }

    return null;
  }

  /**
   * Cache the completed order response to return on idempotent replays
   */
  public static async saveCompletedResult(key: string, data: any, ttlSeconds = 86400): Promise<void> {
    if (!key) return;

    const cacheKey = `idemp_result:${key}`;

    try {
      await cache.set(cacheKey, JSON.stringify(data), ttlSeconds);
    } catch (err) {
      logger.warn(`[IdempotencyManager] Cache set failed, storing in-memory: ${err}`);
    }

    this.memoryCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }
}
