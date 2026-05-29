import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { dbPool } from '../database/index.js';
import { redisClient } from '../utils/redis.js';
import { logger } from '../utils/logger.js';

export interface ApiKeyPayload {
  merchantId: string;
}

declare global {
  namespace Express {
    interface Request {
      merchantApiKey?: ApiKeyPayload;
    }
  }
}

/**
 * Validates Merchant API Key via Redis Cache or Database
 */
export async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({
      error: 'API Key required',
      code: 'API_KEY_MISSING',
    });
    return;
  }

  // Hash the incoming key (we store bcrypt hashes or SHA-256 in DB, let's assume SHA-256 for fast caching)
  // For the sake of matching the DB structure (bcrypt), we would typically use bcrypt.compare.
  // However, looking up by hash is impossible with bcrypt because every salt is unique.
  // If the DB api_key_hash is bcrypt, we cannot query `WHERE api_key_hash = ?`.
  // Standard practice for API keys: store SHA-256 hash in DB, or ID:SECRET format.
  // Assuming the client passes a raw API key. We will hash it using SHA-256 to use as a cache key.
  const rawHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const cacheKey = `merchant:apikey:sha256:${rawHash}`;

  try {
    // 1. Check Redis Cache
    const cachedMerchantId = await redisClient.get(cacheKey);

    if (cachedMerchantId) {
      req.merchantApiKey = { merchantId: cachedMerchantId };
      return next();
    }

    // 2. Cache Miss — Query DB
    // Since api_key_hash might be bcrypt, we might need an ID prefix, e.g., `merch_123.secret456`.
    // But since this is a general architectural upgrade, let's assume `api_key_hash` in DB is SHA-256 for fast lookup.
    const result = await dbPool.query(
      'SELECT id, is_active FROM merchants WHERE api_key_hash = $1',
      [rawHash]
    );

    if (result.rows.length === 0) {
      // Small delay to prevent timing attacks
      await new Promise(r => setTimeout(r, Math.random() * 50 + 50));
      res.status(401).json({
        error: 'Invalid API Key',
        code: 'INVALID_API_KEY',
      });
      return;
    }

    const merchant = result.rows[0];

    if (!merchant.is_active) {
      res.status(403).json({
        error: 'Merchant account is inactive',
        code: 'ACCOUNT_INACTIVE',
      });
      return;
    }

    // 3. Populate Cache (TTL: 15 minutes)
    await redisClient.set(cacheKey, merchant.id, 'EX', 900);

    req.merchantApiKey = { merchantId: merchant.id };
    next();
  } catch (error) {
    logger.error('API Key validation error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
}
