import { jest } from '@jest/globals';

// Mock dependencies before importing KeeperService
jest.mock('../../config/index.js', () => ({
  config: {
    keeper: {
      cronSchedule: '* * * * *',
      maxConcurrentWorkers: 2,
      maxRetryAttempts: 3,
    },
    stellar: {
      rpcUrl: 'https://soroban-testnet.stellar.org',
      isMainnet: false,
    },
  },
}));

jest.mock('../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../utils/redis.js', () => ({
  isRedisAvailable: jest.fn().mockReturnValue(true),
  getRedisClient: jest.fn().mockReturnValue({ duplicate: () => ({}) }),
}));

jest.mock('../../utils/redisLock.js', () => ({
  RedisLock: jest.fn<any>().mockImplementation(() => ({
    acquire: jest.fn<any>().mockResolvedValue(true),
    release: jest.fn<any>().mockResolvedValue(undefined),
  })),
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn<any>().mockReturnValue({
    stop: jest.fn<any>(),
  }),
}));

// We mock bullmq to avoid actual Redis connections during testing
jest.mock('bullmq', () => {
  return {
    Queue: jest.fn<any>().mockImplementation(() => ({
      add: jest.fn<any>().mockResolvedValue(true),
      getWaitingCount: jest.fn<any>().mockResolvedValue(0),
      getFailedCount: jest.fn<any>().mockResolvedValue(0),
      close: jest.fn<any>().mockResolvedValue(undefined),
    })),
    Worker: jest.fn<any>().mockImplementation(() => ({
      on: jest.fn<any>(),
      close: jest.fn<any>().mockResolvedValue(undefined),
    })),
  };
});

import { KeeperService } from '../index.js';
import * as redisModule from '../../utils/redis.js';
import { Queue } from 'bullmq';

describe('KeeperService', () => {
  let keeper: KeeperService;

  beforeEach(() => {
    jest.clearAllMocks();
    keeper = new KeeperService();
  });

  afterEach(async () => {
    await keeper.stop();
  });

  it('should initialize successfully when Redis is available', async () => {
    (redisModule.isRedisAvailable as jest.Mock).mockReturnValue(true);

    await keeper.start();

    expect(Queue).toHaveBeenCalledTimes(1);
    
    const stats = keeper.getStats();
    expect(stats.jobsProcessed).toBe(0);
    expect(stats.jobsFailed).toBe(0);
  });

  it('should fallback gracefully when Redis is unavailable', async () => {
    // Mock redis as unavailable
    (redisModule.isRedisAvailable as jest.Mock).mockReturnValue(false);

    await keeper.start();

    // The queue should not be instantiated
    expect(Queue).not.toHaveBeenCalled();

    const stats = keeper.getStats();
    expect(stats.jobsProcessed).toBe(0);
  });
});
