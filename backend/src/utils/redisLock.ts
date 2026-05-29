import { redisClient } from './redis.js';
import { logger } from './logger.js';
import crypto from 'crypto';

export class RedisLock {
  private key: string;
  private ttlSeconds: number;
  private token: string;

  constructor(key: string, ttlSeconds: number = 60) {
    this.key = `lock:${key}`;
    this.ttlSeconds = ttlSeconds;
    this.token = crypto.randomUUID();
  }

  /**
   * Attempts to acquire the lock. Returns true if acquired.
   */
  async acquire(): Promise<boolean> {
    try {
      const result = await redisClient.set(this.key, this.token, 'EX', this.ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err) {
      logger.error('Failed to acquire Redis lock', { key: this.key, error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  }

  /**
   * Releases the lock ONLY if this instance holds it (using the token).
   */
  async release(): Promise<void> {
    try {
      // Lua script to check token and delete safely
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
      `;
      await redisClient.eval(script, 1, this.key, this.token);
    } catch (err) {
      logger.error('Failed to release Redis lock', { key: this.key, error: err instanceof Error ? err.message : String(err) });
    }
  }
}
