
import axios from 'axios';
import { logger } from '../utils/logger.js';


export class AnchorService {
  /**
   * Fetch the stellar.toml for a given anchor domain
   */
  static async getToml(domain: string) {
    try {
      const response = await axios.get(`https://${domain}/.well-known/stellar.toml`);
      return this.parseToml(response.data);
    } catch (error: any) {
      logger.error('Failed to fetch stellar.toml', { domain, error: error.message });
      throw new Error(`Could not fetch stellar.toml from ${domain}`);
    }
  }

  /**
   * Parse a basic TOML file (simplified since stellar.toml is a flat key-value with tables)
   */
  private static parseToml(tomlStr: string): Record<string, string> {
    const lines = tomlStr.split('\n');
    const result: Record<string, string> = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('[')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length) {
          result[key.trim()] = valueParts.join('=').trim().replace(/"/g, '');
        }
      }
    }
    return result;
  }

  /**
   * Get the SEP-24 Transfer Server URL from the anchor's stellar.toml
   */
  static async getTransferServerUrl(domain: string): Promise<string> {
    const toml = await this.getToml(domain);
    const url = toml['TRANSFER_SERVER_SEP0024'];
    if (!url) {
      throw new Error(`SEP-24 Transfer Server not found in ${domain} TOML`);
    }
    return url;
  }

}
