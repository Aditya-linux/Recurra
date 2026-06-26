import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from './logger.js';

// ============================================================
// Redis Client — Graceful Degradation for Local Development
// ============================================================
// In production, Redis is required (BullMQ, caching, locks).
// In development, if Redis isn't running the server still starts
// and all Redis-dependent features silently fall back to no-ops.
// ============================================================

let _redisClient: Redis | null = null;
let _redisAvailable = false;
let _connectionAttempted = false;

/**
 * Returns true if Redis is connected and usable.
 */
export function isRedisAvailable(): boolean {
  return _redisAvailable;
}

/**
 * Lazy-initializes and returns the Redis client.
 * Returns null if Redis is unavailable (development only).
 * In production, throws if Redis cannot connect.
 */
export function getRedisClient(): Redis | null {
  if (_redisClient) return _redisClient;
  if (_connectionAttempted && !_redisAvailable) return null;
  return _redisClient;
}

/**
 * Initialize the Redis connection. Called once at startup.
 * Resolves to true if connected, false if unavailable.
 */
export async function initRedis(): Promise<boolean> {
  if (_connectionAttempted) return _redisAvailable;
  _connectionAttempted = true;

  return new Promise<boolean>((resolve) => {
    try {
      const client = new Redis(config.redis.url, {
        password: config.redis.password,
        tls: config.redis.tls ? {} : undefined,
        maxRetriesPerRequest: null, // Required by bullmq
        retryStrategy(times) {
          // In development, give up after 3 fast retries
          if (!config.app.isProduction && times >= 3) {
            return null; // Stop retrying
          }
          // In production, keep retrying with exponential backoff
          return Math.min(times * 500, 5000);
        },
        lazyConnect: true, // Don't connect until we explicitly call .connect()
      });

      // Set a connection timeout so we don't hang forever
      const timeout = setTimeout(() => {
        if (!_redisAvailable) {
          logger.warn('Redis connection timed out — running without Redis');
          _redisAvailable = false;
          client.disconnect(false);
          resolve(false);
        }
      }, 5000); // 5 second timeout

      client.on('connect', () => {
        clearTimeout(timeout);
        _redisAvailable = true;
        _redisClient = client;
        logger.info('✓ Connected to Redis');
        resolve(true);
      });

      client.on('error', (err) => {
        // Only log once to avoid the error spam
        if (!_redisAvailable && !_connectionAttempted) {
          logger.warn('Redis connection error', { error: err.message });
        }
      });

      client.on('close', () => {
        _redisAvailable = false;
      });

      client.connect().catch((err) => {
        clearTimeout(timeout);
        if (config.app.isProduction) {
          logger.error('FATAL: Redis connection failed in production', { error: err.message });
          process.exit(1);
        }
        logger.warn(`⚠️ Redis unavailable (${err.code || err.message}) — running without Redis`);
        _redisAvailable = false;
        resolve(false);
      });
    } catch (err: any) {
      logger.warn(`⚠️ Redis initialization failed: ${err.message}`);
      _redisAvailable = false;
      resolve(false);
    }
  });
}

// ============================================================
// Backward-compatible export: `redisClient`
// ============================================================
// Many modules import { redisClient } from './redis.js'.
// We keep this export for compatibility but it's now a Proxy
// that safely no-ops when Redis is down.
// ============================================================

const NOOP_ASYNC = async () => null;

/**
 * A proxy that forwards calls to the real Redis client when available,
 * or returns safe no-op responses when Redis is down.
 */
export const redisClient: Redis = new Proxy({} as Redis, {
  get(_target, prop: string) {
    const client = _redisClient;

    // If Redis is available, forward everything to the real client
    if (client && _redisAvailable) {
      const value = (client as any)[prop];
      if (typeof value === 'function') {
        return value.bind(client);
      }
      return value;
    }

    // Redis is unavailable — return safe fallbacks
    switch (prop) {
      case 'get':
        return NOOP_ASYNC;
      case 'set':
        return NOOP_ASYNC;
      case 'del':
        return NOOP_ASYNC;
      case 'incr':
        return async () => 0;
      case 'expire':
        return NOOP_ASYNC;
      case 'eval':
        return NOOP_ASYNC;
      case 'on':
        return () => {}; // No-op event listener
      case 'status':
        return 'end'; // Indicate disconnected
      case 'disconnect':
      case 'quit':
        return NOOP_ASYNC;
      case 'duplicate':
        return () => redisClient; // Return the proxy itself
      default:
        // For any other method call, return a no-op async function
        if (typeof prop === 'string' && !prop.startsWith('_')) {
          return NOOP_ASYNC;
        }
        return undefined;
    }
  },
});
