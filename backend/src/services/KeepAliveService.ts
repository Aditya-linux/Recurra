/**
 * KeepAlive Service — Free-tier cold-start prevention
 *
 * Prevents TWO free-tier services from sleeping:
 *
 * 1. Render free tier — spins down after 15 min of inactivity
 *    → Self-pings /health every 14 minutes
 *
 * 2. Supabase free tier — pauses DB after 7 days of inactivity
 *    → Runs a lightweight SELECT 1 every 3 days
 *
 * When we upgrade to paid plans, set KEEPALIVE_ENABLED=false.
 */

import { logger } from '../utils/logger.js';
import { dbPool } from '../database/index.js';

// ============================================================
// Render Keep-Alive (every 14 minutes)
// ============================================================

const RENDER_PING_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

let renderPingIntervalId: ReturnType<typeof setInterval> | null = null;

async function pingRenderHealth(): Promise<void> {
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
      logger.debug(`[KeepAlive] ✓ Render ping → ${response.status}`);
    } else {
      logger.warn(`[KeepAlive] ⚠ Render ping returned ${response.status}`);
    }
  } catch (err: any) {
    logger.warn(`[KeepAlive] ✗ Render ping failed: ${err.message}`);
  }
}

// ============================================================
// Supabase Keep-Alive (every 3 days)
// ============================================================

// Supabase free tier pauses after 7 days of inactivity.
// Pinging every 3 days gives us comfortable margin.
const SUPABASE_PING_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

let supabasePingIntervalId: ReturnType<typeof setInterval> | null = null;

async function pingSupabase(): Promise<void> {
  try {
    const result = await dbPool.query('SELECT 1 AS alive');
    if (result.rows[0]?.alive === 1) {
      logger.info('[KeepAlive] ✓ Supabase DB alive');
    }
  } catch (err: any) {
    logger.warn(`[KeepAlive] ✗ Supabase ping failed: ${err.message}`);
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Start all keepalive pingers.
 * Called once during server startup.
 */
export function startKeepAlive(): void {
  const enabled = process.env.KEEPALIVE_ENABLED !== 'false';

  if (!enabled) {
    logger.info('[KeepAlive] Disabled by KEEPALIVE_ENABLED=false (paid tier)');
    return;
  }

  // --- Render keep-alive ---
  pingRenderHealth().catch(() => {});
  renderPingIntervalId = setInterval(() => {
    pingRenderHealth().catch(() => {});
  }, RENDER_PING_INTERVAL_MS);

  // --- Supabase keep-alive ---
  // Don't ping immediately on startup (DB connection is already fresh)
  supabasePingIntervalId = setInterval(() => {
    pingSupabase().catch(() => {});
  }, SUPABASE_PING_INTERVAL_MS);

  logger.info(
    `[KeepAlive] Started — Render: every 14min, Supabase: every 3 days`
  );
}

/**
 * Stop all keepalive pingers gracefully (called on SIGTERM/SIGINT).
 */
export function stopKeepAlive(): void {
  if (renderPingIntervalId) {
    clearInterval(renderPingIntervalId);
    renderPingIntervalId = null;
  }
  if (supabasePingIntervalId) {
    clearInterval(supabasePingIntervalId);
    supabasePingIntervalId = null;
  }
  logger.info('[KeepAlive] Stopped');
}
