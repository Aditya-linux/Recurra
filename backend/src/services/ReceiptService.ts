import { dbPool } from '../database/index.js';

export class ReceiptService {
  /**
   * Generates structured receipt data for a payment
   */
  static async getReceiptData(paymentId: string) {
    const query = `
      SELECT 
        p.id as payment_id, p.transaction_hash, p.amount, p.executed_at, p.payment_number,
        s.id as subscription_id,
        pl.name as plan_name, pl.token_address,
        m.business_name as merchant_name, m.business_email as merchant_email,
        u.email as user_email
      FROM payments p
      JOIN subscriptions s ON p.subscription_id = s.id
      JOIN plans pl ON s.plan_id = pl.id
      JOIN merchants m ON s.merchant_id = m.id
      JOIN users u ON s.user_id = u.id
      WHERE p.id = $1
    `;
    const result = await dbPool.query(query, [paymentId]);
    const data = result.rows[0];

    if (!data) return null;

    // Format for display
    const receiptNumber = `RCPT-${data.payment_id.split('-')[0].toUpperCase()}`;
    const formattedAmount = `${Number(data.amount) / 10_000_000} ${this.getTokenSymbol(data.token_address)}`;
    const date = new Date(data.executed_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${data.transaction_hash}`;

    return {
      receiptNumber,
      date,
      planName: data.plan_name,
      merchantName: data.merchant_name,
      merchantEmail: data.merchant_email,
      userEmail: data.user_email,
      amount: formattedAmount,
      transactionHash: data.transaction_hash,
      paymentNumber: data.payment_number,
      explorerUrl
    };
  }

  private static getTokenSymbol(address: string): string {
    const usdc = process.env.USDC_TOKEN_ADDRESS;
    if (address === usdc) return 'USDC';
    // Native XLM doesn't have a valid contract address on Soroban, but wrapped XLM does
    if (address === process.env.CONTRACT_TOKEN_WRAPPER) return 'XLM';
    return 'TOKEN';
  }
}
