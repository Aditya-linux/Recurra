import { dbPool } from '../database/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { getHealthyRPC } from '../utils/rpcFailover.js';

// Contracts to watch (from config, falling back to known addresses)
const CONTRACTS = [
  config.contracts.paymentEngine,
  config.contracts.subscriptionFactory,
].filter(Boolean);

let isPolling = false;
let pollingInterval: NodeJS.Timeout | null = null;
let lastCursor: string | undefined = undefined;

/**
 * Starts the high-performance event indexer.
 * Polls the Soroban RPC for PaymentExecuted and SubscriptionCreated events.
 */
export const startIndexer = () => {
  if (isPolling) return;
  isPolling = true;
  logger.info('Starting Blockchain Event Indexer...');

  pollingInterval = setInterval(async () => {
    try {
      const rpcServer = await getHealthyRPC();
      const latestLedgerResponse = await rpcServer.getLatestLedger();
      const currentLedger = latestLedgerResponse.sequence;

      let startLedger = currentLedger - 10;
      if (startLedger < 0) startLedger = 0;

      const eventsRequest: any = {
        startLedger,
        filters: [{
          type: 'contract',
          contractIds: CONTRACTS,
          topics: [],
        }],
        pagination: { limit: 100, cursor: lastCursor },
      };

      const response = await rpcServer.getEvents(eventsRequest);

      if (response.events && response.events.length > 0) {
        for (const event of response.events) {
          const eventTypeStr = event.topic?.length > 0 ? String(event.topic[0]) : 'Unknown';
          const eventData = { value: event.value ? String(event.value) : '{}' };

          const res = await dbPool.query(
            `INSERT INTO event_log (event_type, contract_address, ledger_sequence, transaction_hash, event_data)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (contract_address, ledger_sequence, event_type) DO NOTHING
             RETURNING id`,
            [eventTypeStr, event.contractId, event.ledger, event.txHash, eventData]
          );

          if (res.rowCount && res.rowCount > 0) {
            logger.info(`New blockchain event synced: ${eventTypeStr} on ledger ${event.ledger}`);
          }
        }

        lastCursor = response.latestLedger.toString();
      }
    } catch (err) {
      logger.error('Error polling events from Soroban RPC:', err);
    }
  }, 5000);
};

export const stopIndexer = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    isPolling = false;
    logger.info('Blockchain Event Indexer stopped.');
  }
};

