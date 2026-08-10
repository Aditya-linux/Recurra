import axios from 'axios';
import { logger } from '../utils/logger.js';

export class CurrencyService {
  /**
   * Fetch live exchange rates against USD
   * This is a mock implementation. In a real app, you would use an API like Fixer, OpenExchangeRates, or Coinbase.
   */
  static async getExchangeRates(): Promise<Record<string, number>> {
    // Mock rates for demonstration
    return {
      'USD': 1.0,
      'EUR': 0.92,
      'GBP': 0.79,
      'INR': 83.5,
      'BRL': 5.2,
      'XLM': 8.5 // 1 USD = 8.5 XLM
    };
  }

  /**
   * Convert an amount from one currency to another
   */
  static async convert(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
    const rates = await this.getExchangeRates();
    const fromRate = rates[fromCurrency.toUpperCase()];
    const toRate = rates[toCurrency.toUpperCase()];

    if (!fromRate || !toRate) {
      throw new Error(`Unsupported currency conversion: ${fromCurrency} to ${toCurrency}`);
    }

    // Convert to USD first, then to target currency
    const amountInUSD = amount / fromRate;
    return amountInUSD * toRate;
  }
}
