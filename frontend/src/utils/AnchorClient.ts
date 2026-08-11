/**
 * Utility client for interacting with Stellar Anchors (SEP-10 and SEP-24)
 * Handles fetching TOML, cryptographic authentication, and initiating interactive flows.
 */
export class AnchorClient {
  private static tomlCache: Record<string, any> = {};

  /**
   * Parse a basic TOML file
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
   * Fetch and cache the stellar.toml for a domain
   */
  static async getToml(domain: string) {
    if (this.tomlCache[domain]) {
      return this.tomlCache[domain];
    }
    try {
      const response = await fetch(`https://${domain}/.well-known/stellar.toml`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const toml = this.parseToml(text);
      this.tomlCache[domain] = toml;
      return toml;
    } catch (err: any) {
      console.error(`[AnchorClient] Failed to resolve TOML for ${domain}:`, err);
      throw new Error(`Could not fetch stellar.toml from ${domain}`);
    }
  }

  /**
   * Perform SEP-10 Authentication to get a JWT
   */
  static async authenticate(
    domain: string, 
    account: string, 
    signTransaction: (xdr: string) => Promise<string>
  ): Promise<string> {
    const toml = await this.getToml(domain);
    const authEndpoint = toml.WEB_AUTH_ENDPOINT;
    
    if (!authEndpoint) {
      throw new Error(`WEB_AUTH_ENDPOINT not found in ${domain} TOML`);
    }

    // Step 1: Request Challenge Transaction
    let challengeXdr: string;
    try {
      const authRes = await fetch(`${authEndpoint}?account=${account}`);
      if (!authRes.ok) throw new Error(`Failed to fetch challenge: ${authRes.status}`);
      const authData = await authRes.json();
      challengeXdr = authData.transaction;
      if (!challengeXdr) throw new Error('No transaction returned from auth endpoint');
    } catch (err: any) {
      throw new Error(`Failed to request auth challenge: ${err.message}`);
    }

    // Step 2: Sign the Challenge
    let signedXdr: string;
    try {
      signedXdr = await signTransaction(challengeXdr);
    } catch (err: any) {
      throw new Error('User declined to sign the authentication transaction.');
    }

    // Step 3: Submit signed transaction to get JWT
    try {
      const submitRes = await fetch(authEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: signedXdr })
      });
      
      if (!submitRes.ok) {
        const errorData = await submitRes.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to submit challenge: ${submitRes.status}`);
      }
      
      const submitData = await submitRes.json();
      return submitData.token;
    } catch (err: any) {
      throw new Error(`Failed to get JWT: ${err.message}`);
    }
  }

  /**
   * Initiate SEP-24 Interactive Flow (Deposit / Withdraw)
   */
  static async initiateInteractiveFlow(
    domain: string,
    action: 'deposit' | 'withdraw',
    assetCode: string,
    account: string,
    jwt: string
  ): Promise<string> {
    const toml = await this.getToml(domain);
    const transferServer = toml.TRANSFER_SERVER_SEP0024;
    
    if (!transferServer) {
      throw new Error(`TRANSFER_SERVER_SEP0024 not found in ${domain} TOML`);
    }

    const endpoint = action === 'deposit' ? `${transferServer}/transactions/deposit/interactive` : `${transferServer}/transactions/withdraw/interactive`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({
          asset_code: assetCode,
          account
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to initiate ${action}: ${res.status}`);
      }

      const data = await res.json();
      return data.url;
    } catch (err: any) {
      throw new Error(`Failed to start interactive flow: ${err.message}`);
    }
  }
}
