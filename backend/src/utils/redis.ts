import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from './logger.js';

export const redisClient = new Redis(config.redis.url, {
  password: config.redis.password,
  tls: config.redis.tls ? {} : undefined,
  maxRetriesPerRequest: null, // Required by bullmq
});

redisClient.on('connect', () => {
  logger.debug('Connected to Redis');
});

redisClient.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message });
});
