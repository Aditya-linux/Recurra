/**
 * Recurra — Rate Limiting Middleware
 * 
 * Two-tier rate limiting:
 * 1. IP-based: 100 requests/minute (public endpoints)
 * 2. API key-based: 1000 requests/minute (authenticated endpoints)
 * 
 * @security Prevents DDoS and brute-force attacks
 */

import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Standard IP-based rate limiter (100 req/min)
 */
export const ipRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxPerIp,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP',
    code: 'RATE_LIMITED',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
  },
  handler: (req, res, _next, options) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json(options.message);
  },
  skip: (req) => {
    // Skip rate limiting for health check
    return req.path === '/health';
  },
});

/**
 * Stricter rate limiter for auth endpoints (20 req/min)
 */
export const authRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts',
    code: 'AUTH_RATE_LIMITED',
    retryAfter: 60,
  },
  handler: (req, res, _next, options) => {
    logger.warn('Auth rate limit exceeded — potential brute force', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json(options.message);
  },
});

/**
 * Strict rate limiter for webhook endpoints (50 req/min)
 */
export const webhookRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many webhook triggers',
    code: 'WEBHOOK_RATE_LIMITED',
    retryAfter: 60,
  },
  handler: (req, res, _next, options) => {
    logger.warn('Webhook rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json(options.message);
  },
});

/**
 * API key-based rate limiter (1000 req/min) for merchant integrations
 */
export const apiKeyRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxPerApiKey,
  keyGenerator: (req) => {
    // Use API key or fall back to IP
    return (req.headers['x-api-key'] as string) ?? req.ip ?? 'unknown';
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'API key rate limit exceeded',
    code: 'API_RATE_LIMITED',
  },
});
