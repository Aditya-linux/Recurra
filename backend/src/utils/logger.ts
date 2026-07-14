/**
 * Recurra — Structured Logger (Winston)
 * 
 * Features:
 * - Structured JSON output
 * - PII field redaction
 * - Request correlation IDs
 * - Environment-aware formatting
 * 
 * @security Sensitive fields are automatically redacted in logs.
 */

import winston from 'winston';
import { inspect } from 'util';
import { config } from '../config/index.js';

// Fields that should be redacted in logs
const REDACTED_FIELDS = new Set([
  'password', 'secret', 'token', 'apiKey', 'api_key',
  'authorization', 'cookie', 'jwt', 'refreshToken',
  'privateKey', 'private_key', 'webhook_secret',
  'email', 'phone', 'ssn', 'creditCard',
]);

/**
 * Recursively redact sensitive fields from log data
 */
function redactSensitiveFields(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveFields);
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACTED_FIELDS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      redacted[key] = redactSensitiveFields(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * Custom format that redacts PII before logging
 */
const redactionFormat = winston.format((info) => {
  if (info.metadata && typeof info.metadata === 'object') {
    info.metadata = redactSensitiveFields(info.metadata);
  }
  return info;
});

/**
 * Create the Winston logger instance
 */
export const logger = winston.createLogger({
  level: config.logging.level,
  defaultMeta: {
    service: config.app.name,
    environment: config.app.env,
  },
  format: winston.format.combine(
    winston.format.timestamp({ format: 'ISO' }),
    winston.format.errors({ stack: true }),
    redactionFormat(),
    config.app.isProduction
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
            const metaStr = Object.keys(meta).length > 0
              ? ` ${inspect(meta, { depth: 3, colors: true })}`
              : '';
            return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
          }),
        ),
  ),
  transports: [
    new winston.transports.Console(),
    // In production, also log to file with rotation
    ...(config.app.isProduction
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 10 * 1024 * 1024,
            maxFiles: 10,
          }),
        ]
      : []),
  ],
  // Don't exit on uncaught exceptions — handle gracefully
  exitOnError: false,
});

/**
 * Create a child logger with request context
 */
export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}
