/**
 * Recurra Backend — Application Configuration
 * 
 * Centralized configuration loaded from environment variables.
 * All sensitive values come from .env (never hardcoded).
 * 
 * @security All defaults are safe for development only.
 *           Production values MUST come from environment.
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  // Application
  app: {
    name: 'recurra',
    port: parseInt(process.env['PORT'] ?? process.env['APP_PORT'] ?? '3001', 10),
    host: process.env['RENDER'] === 'true' || process.env['NODE_ENV'] === 'production' ? '0.0.0.0' : (process.env['APP_HOST'] ?? 'localhost'),
    env: process.env['NODE_ENV'] ?? 'development',
    isProduction: process.env['NODE_ENV'] === 'production',
  },

  // Database
  database: {
    url: requireEnv('DATABASE_URL', 'postgresql://recurra_user:password@localhost:5432/recurra_dev'),
    poolMin: parseInt(process.env['DATABASE_POOL_MIN'] ?? '2', 10),
    poolMax: parseInt(process.env['DATABASE_POOL_MAX'] ?? '10', 10),
    ssl: process.env['DATABASE_SSL'] ? process.env['DATABASE_SSL'] === 'true' : process.env['NODE_ENV'] === 'production',
  },

  // Redis
  redis: {
    url: requireEnv('REDIS_URL', 'redis://localhost:6379'),
    password: process.env['REDIS_PASSWORD'] ?? undefined,
    tls: process.env['REDIS_TLS'] === 'true',
  },

  // Authentication
  auth: {
    jwtSecret: requireEnv('JWT_SECRET', 'dev-only-change-in-production-64-chars-minimum-required!!!!!!!!'),
    accessExpiry: process.env['JWT_ACCESS_EXPIRY'] ?? '15m',
    refreshExpiry: process.env['JWT_REFRESH_EXPIRY'] ?? '7d',
    issuer: process.env['JWT_ISSUER'] ?? 'recurra.io',
  },

  // Stellar Network
  stellar: {
    network: process.env['STELLAR_NETWORK'] ?? 'testnet',
    rpcUrl: process.env['STELLAR_RPC_URL'] ?? (
      (process.env['STELLAR_NETWORK'] ?? 'testnet') === 'mainnet'
        ? 'https://soroban-rpc.mainnet.stellar.gateway.fm'
        : 'https://soroban-testnet.stellar.org'
    ),
    horizonUrl: process.env['STELLAR_HORIZON_URL'] ?? (
      (process.env['STELLAR_NETWORK'] ?? 'testnet') === 'mainnet'
        ? 'https://horizon.stellar.org'
        : 'https://horizon-testnet.stellar.org'
    ),
    networkPassphrase: process.env['STELLAR_NETWORK_PASSPHRASE'] ?? (
      (process.env['STELLAR_NETWORK'] ?? 'testnet') === 'mainnet'
        ? 'Public Global Stellar Network ; September 2015'
        : 'Test SDF Network ; September 2015'
    ),
    platformFeeWallet: requireEnv('PLATFORM_FEE_WALLET', 'GATZRECURRADEVWALLETFEECOLLECTORAAAAAAAAAAAAAAAAAAAAAA'),
    /** Whether we are targeting mainnet */
    isMainnet: (process.env['STELLAR_NETWORK'] ?? 'testnet') === 'mainnet',
  },

  // Contract Addresses
  contracts: {
    authorizationManager: process.env['CONTRACT_AUTHORIZATION_MANAGER'] ?? '',
    subscriptionFactory: process.env['CONTRACT_SUBSCRIPTION_FACTORY'] ?? '',
    paymentEngine: process.env['CONTRACT_PAYMENT_ENGINE'] ?? '',
    tokenWrapper: process.env['CONTRACT_TOKEN_WRAPPER'] ?? '',
    escrowDispute: process.env['CONTRACT_ESCROW_DISPUTE'] ?? '',
    usdcToken: process.env['USDC_TOKEN_ADDRESS'] ?? '',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] ?? '60000', 10),
    maxPerIp: parseInt(process.env['RATE_LIMIT_MAX_PER_IP'] ?? '100', 10),
    maxPerApiKey: parseInt(process.env['RATE_LIMIT_MAX_PER_API_KEY'] ?? '1000', 10),
  },

  // CORS
  cors: {
    allowedOrigins: (process.env['CORS_ALLOWED_ORIGINS'] ?? 'http://localhost:3000').split(','),
  },

  // Keeper Service
  keeper: {
    cronSchedule: process.env['KEEPER_CRON_SCHEDULE'] ?? '0 * * * *',
    maxConcurrentWorkers: parseInt(process.env['KEEPER_MAX_CONCURRENT_WORKERS'] ?? '5', 10),
    maxRetryAttempts: parseInt(process.env['KEEPER_MAX_RETRY_ATTEMPTS'] ?? '3', 10),
  },

  // Webhook
  webhook: {
    signingSecret: process.env['WEBHOOK_SIGNING_SECRET'] ?? 'dev-webhook-secret',
    maxRetries: parseInt(process.env['WEBHOOK_MAX_RETRIES'] ?? '5', 10),
    circuitBreakerThreshold: parseInt(process.env['WEBHOOK_CIRCUIT_BREAKER_THRESHOLD'] ?? '100', 10),
  },

  // Platform Fee (basis points, 50 = 0.5%)
  platform: {
    feeBps: parseInt(process.env['PLATFORM_FEE_BPS'] ?? '50', 10),
  },

  // Logging
  logging: {
    level: process.env['LOG_LEVEL'] ?? 'info',
  },
} as const;
