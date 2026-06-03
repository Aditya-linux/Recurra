/**
 * KeepAlive Service — Free-tier cold-start prevention
 *
 * Pings the /health endpoint every 14 minutes to keep Render's free tier
 * from spinning down the service (which causes 50-second cold starts).
 *
 * When we upgrade to Render Starter ($7/month), this service becomes a no-op
 * because paid plans are always warm. The env flag KEEPALIVE_ENABLED lets us
 * toggle it without code changes.
 *
 * Also pings Supabase to keep the DB connection alive (free tier sleeps too).
 */

import { logger } from '../utils/logger.js';

// Ping every 14 minutes — Render free tier sleeps after 15 min of inactivity
const PING_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

let pingIntervalId: ReturnType<typeof setInterval> | null = null;

async function pingHealth(): Promise<void> {
  const selfUrl = process.env.RENDER_EXTERNAL_URL || process.env.KEEPALIVE_URL;

  if (!selfUrl) {
    // No external URL configured — silently skip (local dev)
    return;
  }

  try {
    const response = await fetch(`${selfUrl}/health`, {
      method: 'GET',
      headers: { 'User-Agent': 'Recurra-KeepAlive/1.0' },
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });

    if (response.ok) {
      logger.info(`[KeepAlive] ✓ Pinged ${selfUrl}/health → ${response.status}`);
    } else {
      logger.warn(`[KeepAlive] ⚠ Health ping returned ${response.status}`);
    }
  } catch (err: any) {
    logger.warn(`[KeepAlive] ✗ Ping failed: ${err.message}`);
  }
}

/**
 * Start the keepalive pinger.
 * Called once during server startup.
 */
export function startKeepAlive(): void {
  const enabled = process.env.KEEPALIVE_ENABLED !== 'false';

  if (!enabled) {
    logger.info('[KeepAlive] Disabled by KEEPALIVE_ENABLED=false (paid tier)');
    return;
  }

  // Fire immediately on startup to verify connectivity
  pingHealth().catch(() => {});

  pingIntervalId = setInterval(() => {
    pingHealth().catch(() => {});
  }, PING_INTERVAL_MS);

  logger.info(
    `[KeepAlive] Started — pinging every ${PING_INTERVAL_MS / 60000} minutes to prevent cold starts`
  );
}

/**
 * Stop the keepalive pinger gracefully (called on SIGTERM/SIGINT).
 */
export function stopKeepAlive(): void {
  if (pingIntervalId) {
    clearInterval(pingIntervalId);
    pingIntervalId = null;
    logger.info('[KeepAlive] Stopped');
  }
}
