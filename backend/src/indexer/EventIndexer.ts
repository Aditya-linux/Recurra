import { rpc } from '@stellar/stellar-sdk';
import { dbPool } from '../database/index.js';
import { redisClient } from '../utils/redis.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const CHECKPOINT_KEY = 'indexer:last_ledger';
const RPC_SERVER = new rpc.Server(config.stellar.rpcUrl);

export class EventIndexer {
  private isRunning: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number = 5000;

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('Starting Soroban Event Indexer...');
    await this.poll();
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info('Stopped Soroban Event Indexer');
  }

  private async poll() {
    if (!this.isRunning) return;
    try {
      await this.indexEvents();
    } catch (error) {
      logger.error('Error during event indexing', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      if (this.isRunning) {
        this.timer = setTimeout(() => this.poll(), this.intervalMs);
      }
    }
  }

  private async indexEvents() {
    // 1. Get latest ledger on chain
    const networkInfo = await RPC_SERVER.getLatestLedger();
    const latestLedger = networkInfo.sequence;

    // 2. Get our current checkpoint
    let startLedger = await this.getCheckpoint();
    if (!startLedger) {
      // Start from a few ledgers behind if no checkpoint
      startLedger = Math.max(0, latestLedger - 100);
    }

    if (startLedger > latestLedger) {
      return; // Up to date
    }

    // Process in batches of 1000 ledgers to avoid timeouts
    const maxLedgersPerRequest = 1000;
    const endLedger = Math.min(startLedger + maxLedgersPerRequest, latestLedger);

    const contractsToWatch = [
      config.contracts.subscriptionFactory,
      config.contracts.paymentEngine,
      config.contracts.authorizationManager,
      config.contracts.escrowDispute
    ].filter(Boolean);

    if (contractsToWatch.length === 0) {
      logger.warn('No contracts configured for indexing');
      return;
    }

    // Build filters
    const filters: any[] = contractsToWatch.map(contractId => ({
      type: 'contract',
      contractIds: [contractId]
    }));

    // Fetch events
    const request: any = {
      startLedger,
      filters,
      pagination: { limit: 100 }
    };

    let eventsResponse: any;
    try {
      eventsResponse = await RPC_SERVER.getEvents(request);
    } catch (e) {
      logger.error('Failed to fetch events from Soroban RPC', { error: e instanceof Error ? e.message : String(e) });
      return;
    }

    const events = eventsResponse.events;
    if (events && events.length > 0) {
      logger.info(`Found ${events.length} events from ledger ${startLedger} to ${endLedger}`);
      await this.saveEventsToDb(events);
    }

    // 3. Update checkpoint
    await this.saveCheckpoint(endLedger + 1);
  }

  private async getCheckpoint(): Promise<number | null> {
    const val = await redisClient.get(CHECKPOINT_KEY);
    return val ? parseInt(val, 10) : null;
  }

  private async saveCheckpoint(ledger: number) {
    await redisClient.set(CHECKPOINT_KEY, ledger.toString());
  }

  private async saveEventsToDb(events: any[]) {
    const client = await dbPool.connect();
    try {
      await client.query('BEGIN');
      
      const insertQuery = `
        INSERT INTO event_log (event_type, contract_address, ledger_sequence, transaction_hash, event_data)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (contract_address, ledger_sequence, event_type) DO NOTHING
      `;

      for (const event of events) {
        // Typically event topics dictate the type, we take the first topic as type for simplicity, or "contract_event" if missing
        let eventType = 'unknown';
        if (event.topic.length > 0) {
          // Soroban topics are usually SCVals, you might extract the string value.
          // In stellar-sdk, event.topic is an array of XDR strings or objects
          eventType = typeof event.topic[0] === 'string' ? event.topic[0] : JSON.stringify(event.topic[0]);
        }

        const data = {
          topics: event.topic,
          value: event.value,
        };

        await client.query(insertQuery, [
          eventType,
          event.contractId,
          event.ledger,
          event.txHash,
          JSON.stringify(data)
        ]);
      }
      
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
