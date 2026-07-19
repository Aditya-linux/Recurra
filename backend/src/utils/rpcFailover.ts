/**
 * Multi-RPC Failover for Stellar/Soroban
 *
 * Tries each endpoint in order. If one is unhealthy, moves to next.
 * Prevents total keeper blindness if a single RPC provider goes down.
 */

import { rpc as SorobanRpc } from '@stellar/stellar-sdk';
import { config } from '../config/index.js';
import { logger } from './logger.js';

// Primary + fallback endpoints (configured via env or defaults)
const RPC_ENDPOINTS: string[] = (
  config.stellar.rpcFailoverUrls || config.stellar.rpcUrl
).split(',').map(u => u.trim()).filter(Boolean);

let lastHealthyIndex = 0;

/**
 * Returns a healthy Soroban RPC server, trying each endpoint in order.
 * Starts from the last known healthy endpoint for speed.
 */
export async function getHealthyRPC(): Promise<SorobanRpc.Server> {
  for (let attempt = 0; attempt < RPC_ENDPOINTS.length; attempt++) {
    const idx = (lastHealthyIndex + attempt) % RPC_ENDPOINTS.length;
    const endpoint = RPC_ENDPOINTS[idx]!;

    try {
      const server = new SorobanRpc.Server(endpoint);
      await server.getHealth();

      if (idx !== lastHealthyIndex) {
        logger.warn(`RPC failover: switched to ${endpoint}`);
      }
      lastHealthyIndex = idx;
      return server;
    } catch (err) {
      logger.warn(`RPC endpoint unhealthy: ${endpoint}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  throw new Error('CRITICAL: All Stellar RPC endpoints are down');
}

/** Returns the list of configured endpoints (for health checks) */
export function getRPCEndpoints(): string[] {
  return [...RPC_ENDPOINTS];
}
