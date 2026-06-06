import { rpc } from '@stellar/stellar-sdk';
import { dbPool } from '../database/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const rpcServer = new rpc.Server(config.stellar.rpcUrl);

let isPolling = false;
let pollingInterval: NodeJS.Timeout | null = null;
let lastCursor: string | undefined = undefined;

// Contracts to watch
const CONTRACTS = [
  'CCXDZ7QYQ3HKBNXCLY6EQFCQKZEXUXD3RD7DZLWOYORML2NT5WQ2YNPV', // Payment Engine
  'CAQT5DDXGLSDNFKMPS7JMEHGWK5X27P73LOXJNC6FWXWHE26R6QSIY5V', // Subscription Factory
];

/**
 * Starts the high-performance event indexer
 * Polls the Soroban RPC for PaymentExecuted and SubscriptionCreated events
 */
export const startIndexer = () => {
  if (isPolling) return;
  isPolling = true;
  logger.info('Starting Blockchain Event Indexer...');
  
  pollingInterval = setInterval(async () => {
    try {
      // Get the latest ledger
      const latestLedgerResponse = await rpcServer.getLatestLedger();
      const currentLedger = latestLedgerResponse.sequence;
      
      // Default to checking the last 10 ledgers if no cursor
      let startLedger = currentLedger - 10;
      if (startLedger < 0) startLedger = 0;

      const eventsRequest: any = {
        startLedger,
        filters: [
          {
            type: 'contract',
            contractIds: CONTRACTS,
            topics: [
              // Can add specific topics for xdr encoded 'PaymentExecuted' etc.
            ]
          }
        ],
        pagination: {
          limit: 100,
          cursor: lastCursor
        }
      };

      const response = await rpcServer.getEvents(eventsRequest);
      
      if (response.events && response.events.length > 0) {
        for (const event of response.events) {
          // Idempotent insertion using the uq_event constraint
          const query = `
            INSERT INTO event_log (event_type, contract_address, ledger_sequence, transaction_hash, event_data)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (contract_address, ledger_sequence, event_type) DO NOTHING
            RETURNING id;
          `;
          
          const eventTypeStr = event.topic && event.topic.length > 0 ? String(event.topic[0]) : 'Unknown';
          const eventData = { value: event.value ? String(event.value) : '{}' };

          const res = await dbPool.query(query, [
            eventTypeStr,
            event.contractId,
            event.ledger,
            event.txHash,
            eventData
          ]);

          if (res.rowCount && res.rowCount > 0) {
            logger.info(`New blockchain event synced: ${eventTypeStr} on ledger ${event.ledger}`);
            // TODO: Decode event.value and update subscriptions/payments table
          }
        }
        
        // Update cursor for pagination
        lastCursor = response.latestLedger.toString();
      }
    } catch (err) {
      logger.error('Error polling events from Soroban RPC:', err);
    }
  }, 5000); // Poll every 5 seconds for zero-delay syncing
};

export const stopIndexer = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    isPolling = false;
    logger.info('Blockchain Event Indexer stopped.');
  }
};
